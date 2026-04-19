import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { useAuth } from '@/context/useAuth';
import { isPlatformAdmin } from '@/lib/roles';
import { SmartSelect } from '@/components/SmartSelect';

type PaymentConcept = {
  id: string;
  name: string;
  description: string | null;
  defaultAmount: string;
  isRecurring: boolean;
  recurrencePeriod: string | null;
  isActive: boolean;
  isBase: boolean;
};

type DebtRow = {
  id: string;
  studentId: string;
  conceptId: string;
  amount: string;
  dueDate: string;
  status: string;
  description: string | null;
};

type DebtsResponse = { data: DebtRow[]; meta?: { total: number; page: number; limit: number } };

type StudentOpt = { id: string; matricula: string; fullName: string };

type SchoolRow = { id: string; name: string; code: string };

function moneyEs(n: string): string {
  const x = Number.parseFloat(n);
  if (Number.isNaN(x)) return n;
  return x.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function FinanzasStaffTools() {
  const { user } = useAuth();
  const platformAdmin = isPlatformAdmin(user);

  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [schoolsReady, setSchoolsReady] = useState(!platformAdmin);

  const [concepts, setConcepts] = useState<PaymentConcept[]>([]);
  const [debts, setDebts] = useState<DebtRow[]>([]);
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [includeInactive, setIncludeInactive] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newRecurring, setNewRecurring] = useState(false);
  const [newPeriod, setNewPeriod] = useState('');

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editRecurring, setEditRecurring] = useState(false);
  const [editPeriod, setEditPeriod] = useState('');
  const [editActive, setEditActive] = useState(true);

  const [asStudent, setAsStudent] = useState('');
  const [asConcept, setAsConcept] = useState('');
  const [asAmount, setAsAmount] = useState('');
  const [asDue, setAsDue] = useState(() => new Date().toISOString().slice(0, 10));
  const [asDesc, setAsDesc] = useState('');

  const canPickSchool = platformAdmin;
  const schoolOk = !canPickSchool || !!schoolId;
  const schoolOptions = useMemo(
    () =>
      schools.map((s) => ({
        value: s.id,
        label: `${s.name} (${s.code})`
      })),
    [schools]
  );
  const conceptOptions = useMemo(
    () =>
      concepts
        .filter((c) => c.isActive)
        .map((c) => ({
          value: c.id,
          label: c.name
        })),
    [concepts]
  );

  const studentParams = useMemo(() => {
    if (canPickSchool && schoolId) return { schoolId };
    return undefined;
  }, [canPickSchool, schoolId]);

  const loadStudentOptions = useCallback(
    async (q: string, signal: AbortSignal) => {
      if (!schoolOk) return [];
      const { data } = await api.get<StudentOpt[]>('/api/v1/school/students', {
        params: { ...(studentParams ?? {}), q: q.trim() || undefined, limit: 80 },
        signal
      });
      const rows = Array.isArray(data) ? data : [];
      return rows.map((s) => ({
        value: s.id,
        label: `${s.fullName} — ${s.matricula}`,
        searchText: s.matricula
      }));
    },
    [schoolOk, studentParams]
  );

  const refreshConcepts = useCallback(async () => {
    const { data } = await api.get<PaymentConcept[]>('/api/v1/payments/concepts', {
      params: { includeInactive: includeInactive ? 'true' : undefined }
    });
    setConcepts(Array.isArray(data) ? data : []);
  }, [includeInactive]);

  const refreshDebts = useCallback(async () => {
    const { data } = await api.get<DebtsResponse>('/api/v1/payments/debts', {
      params: { page: 1, limit: 50 }
    });
    const rows = data && typeof data === 'object' && 'data' in data ? data.data : [];
    setDebts(Array.isArray(rows) ? rows : []);
  }, []);

  const refreshStudents = useCallback(async () => {
    if (!schoolOk) {
      setStudents([]);
      return;
    }
    const { data } = await api.get<StudentOpt[]>('/api/v1/school/students', { params: studentParams });
    setStudents(Array.isArray(data) ? data : []);
  }, [schoolOk, studentParams]);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      await Promise.all([refreshConcepts(), refreshDebts(), refreshStudents()]);
    } catch (e) {
      setError(getUserFacingMessage(e, 'No se pudieron cargar los datos de finanzas.'));
    }
  }, [refreshConcepts, refreshDebts, refreshStudents]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!platformAdmin) {
        setSchoolsReady(true);
        return;
      }
      try {
        const { data } = await api.get<SchoolRow[]>('/api/v1/schools');
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setSchools(list);
        setSchoolId(list[0]?.id ?? '');
      } catch {
        if (!cancelled) setSchools([]);
      } finally {
        if (!cancelled) setSchoolsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [platformAdmin]);

  useEffect(() => {
    if (!schoolsReady) return;
    if (canPickSchool && !schoolId) {
      setLoading(false);
      setStudents([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadAll();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [schoolsReady, canPickSchool, schoolId, loadAll, includeInactive]);

  function startEdit(c: PaymentConcept) {
    setEditId(c.id);
    setEditName(c.name);
    setEditDesc(c.description ?? '');
    setEditAmount(String(c.defaultAmount));
    setEditRecurring(c.isRecurring);
    setEditPeriod(c.recurrencePeriod ?? '');
    setEditActive(c.isActive);
    setMessage(null);
    setError(null);
  }

  function cancelEdit() {
    setEditId(null);
  }

  async function onCreateConcept(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const amount = Number.parseFloat(newAmount.replace(',', '.'));
      if (Number.isNaN(amount) || amount < 0) {
        setError('Indique un importe válido.');
        return;
      }
      await api.post('/api/v1/payments/concepts', {
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        defaultAmount: amount,
        isRecurring: newRecurring,
        recurrencePeriod: newRecurring && newPeriod ? newPeriod : undefined
      });
      setNewName('');
      setNewDesc('');
      setNewAmount('');
      setNewRecurring(false);
      setNewPeriod('');
      setMessage('Concepto creado.');
      await refreshConcepts();
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudo crear el concepto.'));
    } finally {
      setSaving(false);
    }
  }

  async function onUpdateConcept(e: FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const amount = Number.parseFloat(editAmount.replace(',', '.'));
      if (Number.isNaN(amount) || amount < 0) {
        setError('Indique un importe válido.');
        return;
      }
      await api.patch(`/api/v1/payments/concepts/${editId}`, {
        name: editName.trim(),
        description: editDesc,
        defaultAmount: amount,
        isRecurring: editRecurring,
        recurrencePeriod: editRecurring ? editPeriod : '',
        isActive: editActive
      });
      setMessage('Concepto actualizado.');
      setEditId(null);
      await refreshConcepts();
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudo actualizar el concepto.'));
    } finally {
      setSaving(false);
    }
  }

  async function onAssignDebt(e: FormEvent) {
    e.preventDefault();
    if (!asStudent || !asConcept) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const amount = Number.parseFloat(asAmount.replace(',', '.'));
      if (Number.isNaN(amount) || amount < 0) {
        setError('Indique un importe válido para la obligación.');
        return;
      }
      await api.post('/api/v1/payments/debts', {
        studentId: asStudent,
        conceptId: asConcept,
        amount,
        dueDate: asDue,
        description: asDesc.trim() || undefined
      });
      setAsAmount('');
      setAsDesc('');
      setMessage('Obligación registrada (colegiatura u otro concepto).');
      await refreshDebts();
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudo registrar la obligación.'));
    } finally {
      setSaving(false);
    }
  }

  const conceptNameById = useMemo(() => {
    const m = new Map<string, string>();
    concepts.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [concepts]);

  const studentLabelById = useMemo(() => {
    const m = new Map<string, string>();
    students.forEach((s) => m.set(s.id, `${s.fullName} (${s.matricula})`));
    return m;
  }, [students]);

  if (!schoolsReady || loading) {
    return <p className="text-sm text-slate-600">Cargando herramientas de finanzas…</p>;
  }

  if (canPickSchool && !schoolId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Seleccione una escuela para cargar alumnos y asignar colegiaturas u otras obligaciones.
        {schools.length > 0 && (
          <div className="ml-3 mt-2 max-w-sm">
            <SmartSelect options={schoolOptions} value={schoolId} onChange={setSchoolId} placeholder="— Elegir —" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {canPickSchool && schools.length > 0 && (
        <label className="block max-w-md text-sm">
          <span className="font-medium text-slate-700">Escuela (alumnos para asignar obligaciones)</span>
          <div className="mt-1">
            <SmartSelect options={schoolOptions} value={schoolId} onChange={setSchoolId} placeholder="Escuela" />
          </div>
        </label>
      )}

      {message && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">{message}</p>
      )}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900" role="alert">
          {error}
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Conceptos de cobro</h2>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            Mostrar inactivos
          </label>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Cree los conceptos que la escuela cobra (por ejemplo, colegiatura mensual o materiales) y su importe
          habitual. Los pagos se asignan después a cada alumno.
        </p>

        <form className="mt-6 grid gap-3 border-t border-slate-100 pt-6 sm:grid-cols-2" onSubmit={onCreateConcept}>
          <h3 className="sm:col-span-2 text-sm font-medium text-slate-800">Nuevo concepto</h3>
          <label className="text-sm">
            <span className="text-slate-700">Nombre</span>
            <input
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ej. Colegiatura mensual"
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Importe de referencia</span>
            <input
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="0.00"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-slate-700">Descripción (opcional)</span>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={newRecurring} onChange={(e) => setNewRecurring(e.target.checked)} />
            Recurrente (p. ej. mensual)
          </label>
          {newRecurring && (
            <label className="text-sm">
              <span className="text-slate-700">Periodo</span>
              <select
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={newPeriod}
                onChange={(e) => setNewPeriod(e.target.value)}
              >
                <option value="">— Elegir —</option>
                <option value="MONTHLY">Mensual</option>
                <option value="YEARLY">Anual</option>
              </select>
            </label>
          )}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
            >
              Crear concepto
            </button>
          </div>
        </form>

        {editId && (
          <form
            className="mt-8 grid gap-3 border-t border-slate-200 pt-6 sm:grid-cols-2"
            onSubmit={onUpdateConcept}
          >
            <h3 className="sm:col-span-2 text-sm font-medium text-slate-800">Editar concepto</h3>
            <label className="text-sm">
              <span className="text-slate-700">Nombre</span>
              <input
                required
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-700">Importe de referencia</span>
              <input
                required
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-slate-700">Descripción</span>
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editRecurring} onChange={(e) => setEditRecurring(e.target.checked)} />
              Recurrente
            </label>
            {editRecurring && (
              <label className="text-sm">
                <span className="text-slate-700">Periodo</span>
                <select
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  value={editPeriod}
                  onChange={(e) => setEditPeriod(e.target.value)}
                >
                  <option value="">— Ninguno —</option>
                  <option value="MONTHLY">Mensual</option>
                  <option value="YEARLY">Anual</option>
                </select>
              </label>
            )}
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
              Concepto activo (visible para nuevas obligaciones)
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
              >
                Guardar cambios
              </button>
              <button
                type="button"
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50"
                onClick={cancelEdit}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2 pr-3 font-medium">Nombre</th>
                <th className="py-2 pr-3 font-medium">Importe ref.</th>
                <th className="py-2 pr-3 font-medium">Recurrente</th>
                <th className="py-2 pr-3 font-medium">Estado</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {concepts.map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3">
                    {c.name}
                    {c.isBase && (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">base</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">{moneyEs(c.defaultAmount)}</td>
                  <td className="py-2 pr-3">{c.isRecurring ? c.recurrencePeriod ?? 'sí' : '—'}</td>
                  <td className="py-2 pr-3">{c.isActive ? 'Activo' : 'Inactivo'}</td>
                  <td className="py-2">
                    <button
                      type="button"
                      className="text-sm font-medium text-brand-900 underline hover:text-brand-800"
                      onClick={() => startEdit(c)}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {concepts.length === 0 && <p className="mt-2 text-slate-500">No hay conceptos.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Asignar un pago a un alumno</h2>
        <p className="mt-1 text-sm text-slate-600">
          Registre un pago a cobrar (por ejemplo, una mensualidad) a un alumno de su escuela, partiendo de un
          concepto ya creado.
        </p>
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={onAssignDebt}>
          <label className="text-sm">
            <span className="text-slate-700">Alumno</span>
            <div className="mt-1 min-w-[14rem]">
              <SmartSelect
                loadOptions={loadStudentOptions}
                value={asStudent}
                onChange={setAsStudent}
                placeholder="— Elegir —"
              />
            </div>
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Concepto</span>
            <div className="mt-1 min-w-[12rem]">
              <SmartSelect
                options={conceptOptions}
                value={asConcept}
                onChange={(id) => {
                  setAsConcept(id);
                  const c = concepts.find((x) => x.id === id);
                  if (c) setAsAmount(String(c.defaultAmount));
                }}
                placeholder="— Elegir —"
              />
            </div>
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Importe</span>
            <input
              required
              className="mt-1 w-32 rounded border border-slate-300 px-3 py-2"
              value={asAmount}
              onChange={(e) => setAsAmount(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Vencimiento</span>
            <input
              type="date"
              required
              className="mt-1 rounded border border-slate-300 px-3 py-2"
              value={asDue}
              onChange={(e) => setAsDue(e.target.value)}
            />
          </label>
          <label className="text-sm min-w-[10rem] flex-1">
            <span className="text-slate-700">Nota (opcional)</span>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={asDesc}
              onChange={(e) => setAsDesc(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={saving || !schoolOk}
            className="rounded bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
          >
            Asignar pago
          </button>
        </form>
        {students.length === 0 && schoolOk && (
          <p className="mt-3 text-sm text-amber-800">Aún no hay alumnos cargados en esta escuela.</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Pagos asignados recientes</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2 pr-3 font-medium">Alumno</th>
                <th className="py-2 pr-3 font-medium">Concepto</th>
                <th className="py-2 pr-3 font-medium">Importe</th>
                <th className="py-2 pr-3 font-medium">Vence</th>
                <th className="py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {debts.map((d) => (
                <tr key={d.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3">{studentLabelById.get(d.studentId) ?? d.studentId.slice(0, 8) + '…'}</td>
                  <td className="py-2 pr-3">{conceptNameById.get(d.conceptId) ?? '—'}</td>
                  <td className="py-2 pr-3">{moneyEs(d.amount)}</td>
                  <td className="py-2 pr-3">{d.dueDate?.slice(0, 10) ?? '—'}</td>
                  <td className="py-2">{d.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {debts.length === 0 && <p className="mt-2 text-slate-500">No hay obligaciones listadas.</p>}
        </div>
      </section>
    </div>
  );
}
