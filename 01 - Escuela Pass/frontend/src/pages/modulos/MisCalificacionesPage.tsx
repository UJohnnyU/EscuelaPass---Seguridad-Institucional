import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SmartSelect } from '@/components/SmartSelect';
import { DetailModal } from '@/components/DetailModal';
import { SCROLLABLE_PANEL_BODY } from '@/components/DataTableScroll';
import { Skeleton } from '@/components/Skeleton';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { useAuth } from '@/context/useAuth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useAbortable } from '@/hooks/use-abortable';

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
type PeriodOption = { id: string; schoolYear: string; name: string; schoolName?: string | null };

function scoreMood(score: number, maxScore: number): { emoji: string; label: string; tone: string } {
  const ratio = maxScore > 0 ? score / maxScore : 0;
  if (ratio >= 0.98) return { emoji: '🤩', label: '¡Excelente!', tone: 'text-emerald-700 dark:text-emerald-300' };
  if (ratio >= 0.9) return { emoji: '😄', label: '¡Muy buen trabajo!', tone: 'text-emerald-700 dark:text-emerald-300' };
  if (ratio >= 0.75) return { emoji: '🙂', label: 'Vas por buen camino', tone: 'text-sky-700 dark:text-sky-300' };
  if (ratio >= 0.6) return { emoji: '😐', label: 'Puedes mejorar con práctica', tone: 'text-amber-700 dark:text-amber-300' };
  return { emoji: '💪', label: 'No te rindas, sigue intentando', tone: 'text-rose-700 dark:text-rose-300' };
}

/** Fecha límite YYYY-MM-DD en calendario local (evita mostrar un día antes por UTC). */
function formatDueDateLocalYmd(dueYmd: string | null | undefined): string {
  if (!dueYmd || !/^\d{4}-\d{2}-\d{2}/.test(dueYmd)) return '—';
  const [yy, mm, dd] = dueYmd.slice(0, 10).split('-').map(Number);
  if (!yy || !mm || !dd) return '—';
  const d = new Date(yy, mm - 1, dd);
  return d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function MisCalificacionesPage() {
  const { user } = useAuth();
  const isParent = user?.role === 'PADRE';
  const [searchParams] = useSearchParams();
  const activityFromUrl = searchParams.get('activity');
  const studentFromUrl = searchParams.get('studentId') ?? '';

  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filterChild, setFilterChild] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [openRow, setOpenRow] = useState<ActivityRow | null>(null);
  const [allPeriods, setAllPeriods] = useState<PeriodOption[]>([]);

  // Debounce de filterPeriod ~250 ms para no disparar fetch en cada pulsación (5.4)
  const debouncedFilterPeriod = useDebouncedValue(filterPeriod, 250);

  const endpoint = isParent ? '/api/v1/activities/parent/my-children' : '/api/v1/activities/student/me';

  const { signal, abort } = useAbortable();
  const hasDataRef = useRef(false);

  const load = useCallback(async () => {
    abort();
    setErr(null);
    if (!hasDataRef.current) setLoading(true);
    else setRefreshing(true);
    try {
      const params: Record<string, string> = {};
      if (isParent && filterChild) params.studentId = filterChild;
      if (debouncedFilterPeriod) params.periodId = debouncedFilterPeriod;
      const { data } = await api.get<ActivityRow[]>(endpoint, { params, signal });
      setRows(Array.isArray(data) ? data : []);
      hasDataRef.current = true;
    } catch (e) {
      if ((e as { name?: string })?.name === 'CanceledError') return;
      setErr(getUserFacingMessage(e));
      if (!hasDataRef.current) setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, filterChild, debouncedFilterPeriod, isParent]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (studentFromUrl) setFilterChild(studentFromUrl);
  }, [studentFromUrl]);

  useEffect(() => {
    if (!activityFromUrl || loading) return;
    const row = rows.find((r) => r.id === activityFromUrl);
    if (row) setOpenRow(row);
  }, [activityFromUrl, rows, loading]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<PeriodOption[]>(
          '/api/v1/academic-periods'
        );
        if (!cancelled) setAllPeriods(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setAllPeriods([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const children: ChildOption[] = useMemo(() => {
    if (!isParent) return [];
    const map = new Map<string, string>();
    for (const r of rows) {
      if (!r.studentId) continue;
      if (!map.has(r.studentId)) map.set(r.studentId, r.studentId);
    }
    return [...map.entries()].map(([studentId]) => ({ studentId, name: studentId.slice(0, 8) }));
  }, [isParent, rows]);

  const yearOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.schoolYear) set.add(r.schoolYear);
    for (const p of allPeriods) if (p.schoolYear) set.add(p.schoolYear);
    return [
      { value: '', label: 'Todos los años' },
      ...[...set].sort().reverse().map((y) => ({ value: y, label: `Ciclo ${y}` }))
    ];
  }, [rows, allPeriods]);

  const periodOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (!r.periodId) continue;
      if (filterYear && r.schoolYear !== filterYear) continue;
      const periodLabel = r.periodName?.trim() || r.period?.trim() || 'Periodo';
      const yearLabel = r.schoolYear ? ` · ${r.schoolYear}` : '';
      if (!map.has(r.periodId)) map.set(r.periodId, `${periodLabel}${yearLabel}`);
    }
    for (const p of allPeriods) {
      if (filterYear && p.schoolYear !== filterYear) continue;
      if (map.has(p.id)) continue;
      const base = p.name?.trim() || 'Periodo';
      const yearLabel = p.schoolYear ? ` · ${p.schoolYear}` : '';
      const schoolLabel = p.schoolName ? ` · ${p.schoolName}` : '';
      map.set(p.id, `${base}${yearLabel}${schoolLabel}`);
    }
    return [
      { value: '', label: 'Todos los periodos' },
      ...[...map.entries()].map(([value, label]) => ({ value, label }))
    ];
  }, [rows, allPeriods, filterYear]);

  const visibleRows = rows.filter((r) => (filterChild ? r.studentId === filterChild : true));

  // Agrupar por materia para mostrar promedio local (solo actividades cerradas / publicadas)
  const groupedBySubject = useMemo(() => {
    const groups = new Map<string, { subjectId: string; subjectName: string; items: ActivityRow[] }>();
    for (const r of visibleRows) {
      const key = r.subjectId;
      const g = groups.get(key) ?? { subjectId: r.subjectId, subjectName: r.subjectName, items: [] };
      g.items.push(r);
      groups.set(key, g);
    }
    return [...groups.values()];
  }, [visibleRows]);

  return (
    <div className="max-w-5xl animate-fade-in space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {isParent ? 'Calificaciones de mis hijos' : 'Mis calificaciones'}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Aquí solo aparecen las actividades que el docente ya <strong>publicó</strong>. Si ve la marca{' '}
          <em>En revisión</em>, la nota podría cambiar hasta que el docente la cierre nuevamente.
        </p>
      </div>

      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-100">
          {err}
        </div>
      )}

      <section className="rounded border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/20">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {isParent && children.length > 1 && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Hijo/a</span>
              <SmartSelect
                options={[{ value: '', label: 'Todos' }, ...children.map((c) => ({ value: c.studentId, label: c.name }))]}
                value={filterChild}
                onChange={setFilterChild}
                placeholder="Todos"
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Año escolar</span>
            <SmartSelect
              options={yearOptions}
              value={filterYear}
              onChange={(v) => {
                setFilterYear(v);
                setFilterPeriod('');
              }}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Periodo</span>
            <SmartSelect options={periodOptions} value={filterPeriod} onChange={setFilterPeriod} />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {loading ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-4" aria-busy={refreshing || loading}>
        {/* Barra de progreso discreta para refrescos (SWR) */}
        <div
          className={`h-px w-full overflow-hidden transition-opacity duration-300 ${refreshing ? 'opacity-100' : 'opacity-0'}`}
          aria-hidden="true"
        >
          <div className="h-full w-1/2 animate-progress-bar bg-brand-500/70 dark:bg-brand-400/80" />
        </div>
        {loading ? (
          <div className="space-y-3" aria-label="Cargando calificaciones">
            <Skeleton.Card height={120} />
            <Skeleton.Card height={120} />
            <Skeleton.Card height={120} />
          </div>
        ) : groupedBySubject.length === 0 ? (
          <div className="rounded border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-300">
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
                key={g.subjectId}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/20"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/80">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{g.subjectName}</h3>
                  {avg !== null && (
                    (() => {
                      const mood = scoreMood(avg, maxScale > 0 ? maxScale : 10);
                      return (
                        <div className="text-right">
                          <p className={`text-xs font-semibold ${mood.tone}`}>{mood.label}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">{avg.toFixed(2)}</span>
                            {maxScale > 0 ? (
                              <span className="text-slate-500 dark:text-slate-400"> / {maxScale.toFixed(2)}</span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 text-lg leading-none" aria-hidden>
                            {mood.emoji}
                          </p>
                        </div>
                      );
                    })()
                  )}
                </div>
                <div className={`${SCROLLABLE_PANEL_BODY} border-t border-slate-100 dark:border-slate-700`}>
                <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                  {g.items.map((r) => (
                    <li key={r.id + (r.studentId ?? '')}>
                      <button
                        type="button"
                        onClick={() => setOpenRow(r)}
                        className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{r.title}</p>
                            {r.underReview && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                                En revisión
                              </span>
                            )}
                            {r.status === 'OPEN' && !r.underReview && (
                              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-900 dark:bg-sky-900/40 dark:text-sky-100">
                                Vista previa
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {r.periodName ?? r.period}
                            {r.closedAt ? ` · Publicada ${new Date(r.closedAt).toLocaleDateString('es')}` : ''}
                          </p>
                          {r.myNotes && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">“{r.myNotes}”</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                            {r.myScore != null ? parseFloat(r.myScore) : '—'}
                            <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">
                              / {parseFloat(r.maxScore)}
                            </span>
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
                </div>
              </div>
            );
          })
        )}
      </section>
      <DetailModal
        open={openRow !== null}
        title={openRow?.title ?? ''}
        subtitle={openRow ? `${openRow.subjectName}` : undefined}
        badge={
          openRow ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                openRow.underReview
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100'
                  : openRow.status === 'CLOSED'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100'
                    : 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100'
              }`}
            >
              {openRow.underReview ? 'En revisión' : openRow.status === 'CLOSED' ? 'Publicada' : 'Vista previa'}
            </span>
          ) : null
        }
        onClose={() => setOpenRow(null)}
      >
        {openRow ? (
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/80">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Tu calificación
                </p>
                <p className="mt-1 text-3xl font-semibold text-slate-900 dark:text-slate-100">
                  {openRow.myScore != null ? parseFloat(openRow.myScore) : '—'}
                  <span className="ml-1 text-base font-normal text-slate-500 dark:text-slate-400">
                    / {parseFloat(openRow.maxScore)}
                  </span>
                </p>
              </div>
              {openRow.myScore != null && Number(openRow.maxScore) > 0 ? (() => {
                const mood = scoreMood(Number(openRow.myScore), Number(openRow.maxScore));
                return (
                  <div className="text-right">
                    <p className={`text-xs font-semibold uppercase tracking-widest ${mood.tone}`}>{mood.label}</p>
                    <p className="mt-1 text-4xl leading-none" aria-hidden>
                      {mood.emoji}
                    </p>
                  </div>
                );
              })() : null}
            </div>
            {openRow.myNotes ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Observaciones del docente
                </p>
                <p className="mt-1 whitespace-pre-line text-slate-800 dark:text-slate-200">{openRow.myNotes}</p>
              </div>
            ) : null}
            <dl className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-700 sm:grid-cols-2">
              <div>
                <dt className="font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Materia</dt>
                <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{openRow.subjectName}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Periodo</dt>
                <dd className="mt-0.5 text-slate-900 dark:text-slate-100">
                  {openRow.periodName ?? openRow.period}
                  {openRow.schoolYear ? ` · ${openRow.schoolYear}` : ''}
                </dd>
              </div>
              {openRow.groupName ? (
                <div>
                  <dt className="font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Grupo</dt>
                  <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{openRow.groupName}</dd>
                </div>
              ) : null}
              {openRow.dueDate ? (
                <div>
                  <dt className="font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Fecha límite</dt>
                  <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{formatDueDateLocalYmd(openRow.dueDate)}</dd>
                </div>
              ) : null}
              {openRow.closedAt ? (
                <div>
                  <dt className="font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Publicada</dt>
                  <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{new Date(openRow.closedAt).toLocaleString('es')}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}
      </DetailModal>
    </div>
  );
}
