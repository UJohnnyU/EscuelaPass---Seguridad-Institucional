import { useCallback, useEffect, useMemo, useState } from 'react';
import { SmartSelect } from '@/components/SmartSelect';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { useAuth } from '@/context/useAuth';

type ActivityStatus = 'OPEN' | 'CLOSED';

type ActivityRow = {
  id: string;
  subjectId: string;
  subjectName: string;
  title: string;
  period: string;
  periodId: string | null;
  periodName: string | null;
  maxScore: string;
  dueDate: string | null;
  status: ActivityStatus;
  closedAt: string | null;
  publishedAt: string | null;
  underReview: boolean;
  schoolYear: string | null;
  groupName: string | null;
  myScore: string | null;
  myNotes: string | null;
  studentId?: string;
};

type ChildOption = { studentId: string; name: string };

export function MisCalificacionesPage() {
  const { user } = useAuth();
  const isParent = user?.role === 'PADRE';

  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filterChild, setFilterChild] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');

  const endpoint = isParent ? '/api/v1/activities/parent/my-children' : '/api/v1/activities/student/me';

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params: Record<string, string> = {};
      if (isParent && filterChild) params.studentId = filterChild;
      if (filterPeriod) params.periodId = filterPeriod;
      const { data } = await api.get<ActivityRow[]>(endpoint, { params });
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(getUserFacingMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [endpoint, filterChild, filterPeriod, isParent]);

  useEffect(() => {
    void load();
  }, [load]);

  const children: ChildOption[] = useMemo(() => {
    if (!isParent) return [];
    const map = new Map<string, string>();
    for (const r of rows) {
      if (!r.studentId) continue;
      if (!map.has(r.studentId)) map.set(r.studentId, r.studentId);
    }
    return [...map.entries()].map(([studentId]) => ({ studentId, name: studentId.slice(0, 8) }));
  }, [isParent, rows]);

  const periodsList = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.periodId && r.periodName) map.set(r.periodId, `${r.schoolYear ?? ''} · ${r.periodName}`.trim());
    }
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [rows]);

  const periodOptions = useMemo(
    () => [{ value: '', label: 'Todos los periodos' }, ...periodsList],
    [periodsList]
  );

  const visibleRows = rows.filter((r) => (filterChild ? r.studentId === filterChild : true));

  // Agrupar por materia para mostrar promedio local (solo actividades cerradas / publicadas)
  const groupedBySubject = useMemo(() => {
    const groups = new Map<string, { subjectName: string; items: ActivityRow[] }>();
    for (const r of visibleRows) {
      const key = r.subjectId;
      const g = groups.get(key) ?? { subjectName: r.subjectName, items: [] };
      g.items.push(r);
      groups.set(key, g);
    }
    return [...groups.values()];
  }, [visibleRows]);

  return (
    <div className="max-w-5xl animate-fade-in space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">
          {isParent ? 'Calificaciones de mis hijos' : 'Mis calificaciones'}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          Aquí solo aparecen las actividades que el docente ya <strong>publicó</strong>. Si ve la marca{' '}
          <em>En revisión</em>, la nota podría cambiar hasta que el docente la cierre nuevamente.
        </p>
      </div>

      {err && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>}

      <section className="rounded border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {isParent && children.length > 1 && (
            <label className="block text-sm">
              <span className="text-slate-700">Hijo/a</span>
              <div className="mt-1">
                <SmartSelect
                  options={[{ value: '', label: 'Todos' }, ...children.map((c) => ({ value: c.studentId, label: c.name }))]}
                  value={filterChild}
                  onChange={setFilterChild}
                  placeholder="Todos"
                />
              </div>
            </label>
          )}
          <label className="block text-sm">
            <span className="text-slate-700">Periodo</span>
            <div className="mt-1">
              <SmartSelect options={periodOptions} value={filterPeriod} onChange={setFilterPeriod} />
            </div>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {loading ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {loading ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : groupedBySubject.length === 0 ? (
          <div className="rounded border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
            Aún no hay calificaciones publicadas para mostrar.
          </div>
        ) : (
          groupedBySubject.map((g) => {
            const closedScored = g.items.filter((x) => x.status === 'CLOSED' && x.myScore != null);
            const avg =
              closedScored.length > 0
                ? closedScored.reduce((acc, r) => {
                    const score = Number(r.myScore);
                    if (!Number.isFinite(score)) return acc;
                    return acc + score;
                  }, 0) / closedScored.length
                : null;
            const maxScale = g.items.reduce(
              (acc, r) => Math.max(acc, Number(r.maxScore) || 0),
              0
            );
            return (
              <div
                key={g.subjectName}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-800">{g.subjectName}</h3>
                  {avg !== null && (
                    <p className="text-xs text-slate-600">
                      Promedio:{' '}
                      <span className="font-semibold text-slate-900">{avg.toFixed(2)}</span>
                      {maxScale > 0 ? (
                        <span className="text-slate-500"> / {maxScale.toFixed(2)}</span>
                      ) : null}
                    </p>
                  )}
                </div>
                <ul className="divide-y divide-slate-100">
                  {g.items.map((r) => (
                    <li
                      key={r.id + (r.studentId ?? '')}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-slate-900">{r.title}</p>
                          {r.underReview && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                              En revisión
                            </span>
                          )}
                          {r.status === 'OPEN' && !r.underReview && (
                            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-900">
                              Vista previa
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {r.periodName ?? r.period}
                          {r.closedAt ? ` · Publicada ${new Date(r.closedAt).toLocaleDateString('es')}` : ''}
                        </p>
                        {r.myNotes && <p className="mt-0.5 text-xs text-slate-500">“{r.myNotes}”</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-slate-900">
                          {r.myScore != null ? parseFloat(r.myScore) : '—'}
                          <span className="ml-1 text-xs font-normal text-slate-500">
                            / {parseFloat(r.maxScore)}
                          </span>
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
