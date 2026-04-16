import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';

type School = {
  id: string;
  name: string;
  code: string;
  status: boolean;
  maxGradeScale: string;
};

export function SchoolsAdminPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [maxGradeScale, setMaxGradeScale] = useState('100.00');

  const loadSchools = async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data } = await api.get<School[]>('/api/v1/schools');
      setSchools(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(getUserFacingMessage(e));
      setSchools([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSchools();
  }, []);

  const createSchool = async () => {
    if (!name.trim() || !code.trim() || !maxGradeScale.trim()) {
      setErr('Nombre, código y máximo de calificación son obligatorios.');
      return;
    }
    const max = Number(maxGradeScale.replace(',', '.'));
    if (!Number.isFinite(max) || max < 1 || max > 999.99) {
      setErr('Máximo de calificación inválido. Use un valor entre 1 y 999.99.');
      return;
    }
    const maxScaled = Math.round(max * 100);
    if (Math.abs(max * 100 - maxScaled) > 1e-9) {
      setErr('El máximo de calificación debe tener máximo 2 decimales.');
      return;
    }
    setErr(null);
    setOk(null);
    try {
      await api.post('/api/v1/schools', {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        maxGradeScale: Number((maxScaled / 100).toFixed(2))
      });
      setOk('Escuela creada correctamente.');
      setName('');
      setCode('');
      setMaxGradeScale('100.00');
      await loadSchools();
    } catch (e) {
      setErr(getUserFacingMessage(e));
    }
  };

  const toggleSchoolStatus = async (school: School) => {
    setErr(null);
    setOk(null);
    try {
      await api.patch(`/api/v1/schools/${school.id}`, {
        status: !school.status
      });
      setOk(`Escuela ${!school.status ? 'activada' : 'desactivada'}.`);
      await loadSchools();
    } catch (e) {
      setErr(getUserFacingMessage(e));
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Escuelas (administración global)</h1>
        <p className="mt-2 text-sm text-slate-600">
          Este panel es exclusivo del rol <strong>ADMIN</strong> para crear y administrar escuelas en la plataforma.
        </p>
      </div>

      {err && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>}
      {ok && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{ok}</div>
      )}

      <section className="rounded border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Nueva escuela</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Código (ej. COLEGIO-NORTE)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Máximo de calificación (ej. 100.00)"
            value={maxGradeScale}
            onChange={(e) => setMaxGradeScale(e.target.value)}
            inputMode="decimal"
          />
          <button
            type="button"
            onClick={() => void createSchool()}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Crear escuela
          </button>
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Escuelas registradas</h2>
        </div>
        {loading ? (
          <p className="px-4 py-4 text-sm text-slate-600">Cargando...</p>
        ) : schools.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-600">No hay escuelas registradas.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {schools.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium text-slate-900">{s.name}</p>
                  <p className="text-xs text-slate-500">
                    {s.code} · Máximo: {s.maxGradeScale} · {s.status ? 'Activa' : 'Inactiva'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void toggleSchoolStatus(s)}
                  className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
                >
                  {s.status ? 'Desactivar' : 'Activar'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
