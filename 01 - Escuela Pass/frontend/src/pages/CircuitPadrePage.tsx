import { type FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { CIRCUIT_STATUS_LABEL, PICKUP_METHOD_LABEL } from '@/lib/circuit-labels';
import { useAuth } from '@/context/useAuth';

type StudentRow = { id: string; matricula: string; fullName: string };
type ParentStudents = { parentId: string; students: StudentRow[] };
type Vehicle = { id: string; plate: string; description?: string | null };
type ActiveCircuit = { id: string; status: string; requestTime: string; studentId: string };

const METHODS = ['VEHICULO_REGISTRADO', 'OTRO_VEHICULO', 'A_PIE', 'SOLO_CONSENTIMIENTO'] as const;

export function CircuitPadrePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<ParentStudents | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [pickupMethod, setPickupMethod] = useState<(typeof METHODS)[number]>('A_PIE');
  const [vehicleId, setVehicleId] = useState('');
  const [pickupVehicleDescription, setPickupVehicleDescription] = useState('');
  const [pickupNotes, setPickupNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCircuits, setActiveCircuits] = useState<ActiveCircuit[]>([]);
  const [consentActive, setConsentActive] = useState<Record<string, boolean>>({});
  const [consentSaving, setConsentSaving] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'PADRE') return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        try {
          const activeRes = await api.get<{ active: ActiveCircuit[] }>(
            '/api/v1/circuit-requests/parent/active-all'
          );
          if (cancelled) return;
          if (activeRes.data.active?.length) {
            setActiveCircuits(activeRes.data.active);
            setLoading(false);
            return;
          }
        } catch {
          /* Compatibilidad: si el endpoint no existe, mostrar formulario */
        }
        const [{ data: ps }, { data: vh }, consentRes] = await Promise.all([
          api.get<ParentStudents>('/api/v1/attendance/parent/my-students'),
          api.get<Vehicle[]>('/api/v1/parents/vehicles'),
          api
            .get<Array<{ studentId: string; autonomousToday: boolean }>>(
              '/api/v1/departure-consent/parent/today'
            )
            .catch(() => ({ data: [] as Array<{ studentId: string; autonomousToday: boolean }> }))
        ]);
        if (cancelled) return;
        setData(ps);
        setVehicles(vh);
        const map: Record<string, boolean> = {};
        for (const c of consentRes.data ?? []) {
          map[c.studentId] = c.autonomousToday;
        }
        setConsentActive(map);
        if (ps.students.length) {
          setSelectedStudentIds(new Set([ps.students[0].id]));
        }
      } catch (e) {
        if (!cancelled) setError(getUserFacingMessage(e, 'No se pudieron cargar los datos.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  function toggleStudent(id: string) {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function toggleAutonomousConsent(studentId: string, next: boolean) {
    setConsentSaving(studentId);
    setError(null);
    try {
      await api.post('/api/v1/departure-consent/parent/set', { studentId, active: next });
      setConsentActive((prev) => ({ ...prev, [studentId]: next }));
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudo actualizar el permiso de salida.'));
    } finally {
      setConsentSaving(null);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!data?.parentId || selectedStudentIds.size === 0) {
      setError('Selecciona al menos un estudiante.');
      return;
    }
    const studentIds = [...selectedStudentIds];
    const blockedByConsent = studentIds.filter((id) => consentActive[id]);
    if (blockedByConsent.length) {
      const names = blockedByConsent
        .map((id) => data.students.find((s) => s.id === id)?.fullName ?? id)
        .join(', ');
      setError(`Desactive "Salida autónoma" antes de crear el circuito para: ${names}`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        requestedByParentId: data.parentId,
        pickupMethod
      };
      if (pickupMethod === 'VEHICULO_REGISTRADO') {
        if (!vehicleId) {
          setError('Elige un vehículo registrado o cambia el método de retiro.');
          setSubmitting(false);
          return;
        }
        body.vehicleId = vehicleId;
      }
      if (pickupMethod === 'OTRO_VEHICULO') {
        const desc = pickupVehicleDescription.trim();
        if (!desc) {
          setError('Describe el vehículo o taxi con el que vas a recoger.');
          setSubmitting(false);
          return;
        }
        body.pickupVehicleDescription = desc;
      }
      if (pickupNotes.trim()) body.pickupNotes = pickupNotes.trim();

      if (studentIds.length === 1) {
        const { data: res } = await api.post<{ requestId: string }>('/api/v1/circuit-requests', {
          ...body,
          studentId: studentIds[0]
        });
        navigate(`/app/circuito/${res.requestId}`, { replace: true });
      } else {
        const { data: res } = await api.post<{
          created: Array<{ requestId: string; studentId: string }>;
          errors: Array<{ studentId: string; reason: string }>;
        }>('/api/v1/circuit-requests/batch', { ...body, studentIds });

        if (res.errors.length) {
          const msg = res.errors
            .map(({ studentId, reason }) => {
              const name = data.students.find((s) => s.id === studentId)?.fullName ?? studentId;
              return `${name}: ${reason}`;
            })
            .join(' | ');
          setError(`Algunos circuitos no se crearon: ${msg}`);
        }

        if (res.created.length === 1) {
          navigate(`/app/circuito/${res.created[0].requestId}`, { replace: true });
        } else if (res.created.length > 1) {
          const newCircuits: ActiveCircuit[] = res.created.map((r) => ({
            id: r.requestId,
            status: 'PENDIENTE',
            requestTime: new Date().toISOString(),
            studentId: r.studentId
          }));
          setData((prev) => prev);
          setActiveCircuits(newCircuits);
        }
      }
    } catch (err) {
      setError(getUserFacingMessage(err, 'No se pudo crear la solicitud.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (user?.role !== 'PADRE' && user?.role !== 'ADMIN' && user?.role !== 'ADMINISTRATIVO') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
        <p className="font-medium">Esta sección es para familias o administración.</p>
        <Link to="/app" className="mt-3 inline-block text-brand-800 underline">
          Volver al inicio
        </Link>
      </div>
    );
  }

  if (user?.role !== 'PADRE') {
    return <Navigate to="/app/circuito/hoy" replace />;
  }

  if (activeCircuits.length === 1) {
    return <Navigate to={`/app/circuito/${activeCircuits[0].id}`} replace />;
  }

  if (activeCircuits.length > 1) {
    const studentMap = new Map((data?.students ?? []).map((s) => [s.id, s]));
    return (
      <div className="max-w-lg animate-slide-up space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Circuitos activos hoy</h1>
        <p className="text-sm text-slate-600">
          Tienes {activeCircuits.length} solicitudes de recogida abiertas. Sigue el estado de cada una:
        </p>
        <ul className="space-y-2">
          {activeCircuits.map((c) => {
            const student = studentMap.get(c.studentId);
            return (
              <li key={c.id}>
                <Link
                  to={`/app/circuito/${c.id}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-brand-400 hover:bg-brand-50 transition"
                >
                  <span className="font-medium text-slate-900">
                    {student?.fullName ?? c.studentId}
                    <span className="ml-2 text-xs text-slate-400">{student?.matricula}</span>
                  </span>
                  <span className="text-xs text-slate-500">
                    {CIRCUIT_STATUS_LABEL[c.status] ?? c.status} →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (loading) return <p className="text-slate-600">Cargando…</p>;

  if (!data?.students.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Circuito de recogida</h1>
        <p className="mt-2 text-slate-600">
          Aún no hay alumnos vinculados a su cuenta. Si cree que es un error, comuníquese con secretaría.
        </p>
      </div>
    );
  }

  const anyConsentLocked = [...selectedStudentIds].some((id) => consentActive[id]);
  const formLocked = anyConsentLocked || consentSaving !== null;
  const selectLockedClass = formLocked ? 'cursor-not-allowed opacity-60' : '';

  return (
    <div className="max-w-lg animate-slide-up">
      <h1 className="text-2xl font-bold text-slate-900">Nueva solicitud de recogida</h1>
      <p className="mt-1 text-sm text-slate-600">
        Indique cómo va a recoger a sus hijos. Puede seleccionar uno o varios. Después podrá avisar que va en camino
        y marcar su llegada desde cada solicitud.
      </p>

      <div className="mt-6 space-y-3">
        <p className="text-sm font-medium text-slate-700">Estudiantes a recoger</p>
        {data.students.map((s) => {
          const checked = selectedStudentIds.has(s.id);
          const consent = consentActive[s.id];
          const saving = consentSaving === s.id;
          return (
            <div
              key={s.id}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm space-y-2"
            >
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 accent-brand-600"
                  checked={checked}
                  onChange={() => toggleStudent(s.id)}
                />
                <span className="text-sm font-medium text-slate-900">
                  {s.fullName}
                  <span className="ml-2 text-xs text-slate-500">({s.matricula})</span>
                </span>
              </label>
              <label className="ml-7 flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-300 accent-amber-500"
                  checked={!!consent}
                  disabled={saving}
                  onChange={(ev) => void toggleAutonomousConsent(s.id, ev.target.checked)}
                />
                <span className="text-xs text-slate-600">
                  {consent ? 'Salida autónoma activa (sin circuito)' : 'Activar salida autónoma'}
                </span>
              </label>
              {consent && checked && (
                <p className="ml-7 text-xs text-amber-800">
                  Desactive "Salida autónoma" para incluir a este alumno en el circuito.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="method">
            Forma de retiro
          </label>
          <select
            id="method"
            value={pickupMethod}
            disabled={formLocked}
            onChange={(e) => setPickupMethod(e.target.value as (typeof METHODS)[number])}
            className={`mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none ring-brand-500/30 focus:ring-2 ${selectLockedClass}`}
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {PICKUP_METHOD_LABEL[m] ?? m}
              </option>
            ))}
          </select>
        </div>

        {pickupMethod === 'VEHICULO_REGISTRADO' && (
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="vehicle">
              Vehículo
            </label>
            <select
              id="vehicle"
              value={vehicleId}
              disabled={formLocked}
              onChange={(e) => setVehicleId(e.target.value)}
              className={`mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none ring-brand-500/30 focus:ring-2 ${selectLockedClass}`}
            >
              <option value="">— Elegir —</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate}
                  {v.description ? ` · ${v.description}` : ''}
                </option>
              ))}
            </select>
            {vehicles.length === 0 && (
              <p className="mt-2 text-sm text-amber-800">
                Aún no tiene vehículos registrados. Pídale al plantel que dé de alta su vehículo o elija otra forma de
                recoger.
              </p>
            )}
          </div>
        )}

        {pickupMethod === 'OTRO_VEHICULO' && (
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="pickupVehicleDescription">
              Descripción del vehículo o taxi
            </label>
            <input
              id="pickupVehicleDescription"
              value={pickupVehicleDescription}
              disabled={formLocked}
              onChange={(e) => setPickupVehicleDescription(e.target.value)}
              maxLength={120}
              placeholder="Ej. taxi blanco placas ABC-123, Uber gris, familiar autorizado"
              className={`mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none ring-brand-500/30 focus:ring-2 ${selectLockedClass}`}
            />
            <p className="mt-1 text-xs text-slate-500">
              Esta información ayuda al plantel a validar la entrega cuando no usas un vehículo registrado.
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="pickupNotes">
            Nota para el plantel (opcional)
          </label>
          <textarea
            id="pickupNotes"
            value={pickupNotes}
            disabled={formLocked}
            onChange={(e) => setPickupNotes(e.target.value)}
            maxLength={240}
            rows={3}
            placeholder="Ej. voy con paraguas azul, recojo por acceso norte, llego en taxi."
            className={`mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none ring-brand-500/30 focus:ring-2 ${selectLockedClass}`}
          />
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-800" role="alert">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting || formLocked || selectedStudentIds.size === 0}
          className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting
            ? 'Enviando…'
            : selectedStudentIds.size > 1
              ? `Crear ${selectedStudentIds.size} solicitudes`
              : 'Crear solicitud'}
        </button>
      </form>
    </div>
  );
}
