import { useCallback, useEffect, useMemo, useState } from 'react';
import { SmartSelect } from '@/components/SmartSelect';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { useAuth } from '@/context/useAuth';
import { isPlatformAdmin } from '@/lib/roles';

type TeacherAssignment = {
  groupId: string;
  groupName: string | null;
  grade: string | null;
  schoolYear: string | null;
  subjectId: string;
  subjectName: string;
  schoolId?: string;
  schoolName?: string | null;
  schoolMaxGradeScale?: string | null;
};

type SchoolRow = { id: string; name: string; code: string };

type ActivityStatus = 'OPEN' | 'CLOSED';

type PeriodStatus = 'PLANNED' | 'ACTIVE' | 'CLOSED';

type AcademicPeriod = {
  id: string;
  schoolId: string;
  schoolYear: string;
  name: string;
  orderIndex: number;
  startDate: string;
  endDate: string;
  weight: string;
  status: PeriodStatus;
  closedAt: string | null;
};

type ActivityRow = {
  id: string;
  teacherId: string;
  groupId: string;
  groupName: string | null;
  grade: string | null;
  schoolYear: string | null;
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
  reopenedAt: string | null;
  publishedAt: string | null;
  underReview: boolean;
  gradedCount: number;
  rosterCount: number;
  createdAt: string;
  updatedAt: string;
  schoolId: string | null;
  schoolName: string | null;
};

type BoardResponse = {
  activity: {
    id: string;
    teacherId: string;
    groupId: string;
    subjectId: string;
    subjectName: string;
    periodId: string | null;
    title: string;
    description: string | null;
    period: string;
    maxScore: string;
    dueDate: string | null;
    status: ActivityStatus;
    closedAt: string | null;
    reopenedAt: string | null;
    publishedAt: string | null;
    underReview: boolean;
  };
  rows: Array<{
    studentId: string;
    matricula: string;
    fullName: string;
    grade: {
      id: string;
      score: string;
      notes: string | null;
      gradedAt: string;
    } | null;
  }>;
};

type RowDraft = { score: string; notes: string };

type CreateForm = {
  assignmentKey: string;
  periodId: string;
  title: string;
  description: string;
  maxScore: string;
  dueDate: string;
};

const emptyCreateForm = (): CreateForm => ({
  assignmentKey: '',
  periodId: '',
  title: '',
  description: '',
  maxScore: '',
  dueDate: ''
});

export function CalificacionesDocentePage() {
  const { user } = useAuth();
  const platformAdmin = isPlatformAdmin(user);

  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [schoolFilter, setSchoolFilter] = useState('');
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);

  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [filterAssignment, setFilterAssignment] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | ActivityStatus>('');
  const [filterPeriod, setFilterPeriod] = useState('');

  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreateForm);
  const [creating, setCreating] = useState(false);

  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const schoolFilterOptions = useMemo(
    () => [
      { value: '', label: 'Todas las instituciones' },
      ...schools.map((s) => ({
        value: s.id,
        label: `${s.name} (${s.code})`,
        searchText: s.code
      }))
    ],
    [schools]
  );

  const assignmentSelectOptions = useMemo(
    () =>
      assignments.map((a) => ({
        value: `${a.groupId}::${a.subjectId}`,
        label: `${a.schoolName ? `${a.schoolName} · ` : ''}${a.groupName ?? 'Grupo'} · ${a.grade ?? '—'} · ${a.schoolYear ?? '—'} — ${a.subjectName}`,
        searchText: [a.groupName, a.subjectName, a.schoolName, a.grade].filter(Boolean).join(' ')
      })),
    [assignments]
  );

  const filterAssignmentOptions = useMemo(
    () => [{ value: '', label: 'Todos mis grupos/materias' }, ...assignmentSelectOptions],
    [assignmentSelectOptions]
  );

  useEffect(() => {
    if (!platformAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<SchoolRow[]>('/api/v1/schools');
        if (!cancelled && Array.isArray(data)) setSchools(data);
      } catch {
        if (!cancelled) setSchools([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [platformAdmin]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingAssignments(true);
      setErr(null);
      try {
        const params =
          platformAdmin && schoolFilter.trim() ? { schoolId: schoolFilter.trim() } : undefined;
        const { data } = await api.get<TeacherAssignment[]>(
          '/api/v1/activities/teacher/my-assignments',
          { params }
        );
        if (cancelled) return;
        setAssignments(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) {
          setErr(getUserFacingMessage(e));
          setAssignments([]);
        }
      } finally {
        if (!cancelled) setLoadingAssignments(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [platformAdmin, schoolFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params: Record<string, string> = {};
        if (platformAdmin && schoolFilter.trim()) params.schoolId = schoolFilter.trim();
        const { data } = await api.get<AcademicPeriod[]>('/api/v1/academic-periods', { params });
        if (!cancelled && Array.isArray(data)) setPeriods(data);
      } catch {
        if (!cancelled) setPeriods([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [platformAdmin, schoolFilter]);

  const periodOptions = useMemo(
    () =>
      periods.map((p) => ({
        value: p.id,
        label: `${p.schoolYear} · ${p.name}${p.status === 'ACTIVE' ? ' · Activo' : p.status === 'CLOSED' ? ' · Cerrado' : ' · Planeado'}`,
        searchText: `${p.schoolYear} ${p.name}`
      })),
    [periods]
  );

  const activePeriodOptions = useMemo(
    () => periods.filter((p) => p.status === 'ACTIVE').map((p) => ({ value: p.id, label: `${p.schoolYear} · ${p.name}` })),
    [periods]
  );

  const filterPeriodOptions = useMemo(
    () => [{ value: '', label: 'Todos los periodos' }, ...periodOptions],
    [periodOptions]
  );

  const loadActivities = useCallback(async () => {
    setLoadingActivities(true);
    setErr(null);
    try {
      const params: Record<string, string> = {};
      if (filterAssignment) {
        const [groupId, subjectId] = filterAssignment.split('::');
        if (groupId) params.groupId = groupId;
        if (subjectId) params.subjectId = subjectId;
      }
      if (filterStatus) params.status = filterStatus;
      if (filterPeriod) params.periodId = filterPeriod;
      if (platformAdmin && schoolFilter.trim()) params.schoolId = schoolFilter.trim();
      const { data } = await api.get<ActivityRow[]>('/api/v1/activities', { params });
      setActivities(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(getUserFacingMessage(e));
      setActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  }, [filterAssignment, filterStatus, filterPeriod, platformAdmin, schoolFilter]);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  const selectedCreateAssignment = useMemo(() => {
    if (!createForm.assignmentKey) return null;
    const [groupId, subjectId] = createForm.assignmentKey.split('::');
    return assignments.find((a) => a.groupId === groupId && a.subjectId === subjectId) ?? null;
  }, [assignments, createForm.assignmentKey]);

  useEffect(() => {
    if (!showCreate) return;
    if (!selectedCreateAssignment?.schoolMaxGradeScale) return;
    const n = Number(selectedCreateAssignment.schoolMaxGradeScale);
    if (Number.isFinite(n) && n >= 1) {
      setCreateForm((f) => ({ ...f, maxScore: (Math.round(n * 100) / 100).toFixed(2) }));
    }
  }, [selectedCreateAssignment?.schoolMaxGradeScale, showCreate]);

  const openCreate = () => {
    setErr(null);
    setInfo(null);
    setCreateForm(emptyCreateForm());
    setShowCreate(true);
  };

  const submitCreate = async () => {
    setErr(null);
    setInfo(null);
    const assignment = selectedCreateAssignment;
    if (!assignment) {
      setErr('Seleccione grupo y materia.');
      return;
    }
    const title = createForm.title.trim();
    if (!title) {
      setErr('Indique el título de la actividad.');
      return;
    }
    if (!createForm.periodId) {
      setErr('Seleccione el periodo académico (debe estar ACTIVO).');
      return;
    }
    const body: Record<string, unknown> = {
      groupId: assignment.groupId,
      subjectId: assignment.subjectId,
      periodId: createForm.periodId,
      title
    };
    if (createForm.description.trim()) body.description = createForm.description.trim();
    if (createForm.maxScore.trim()) {
      const n = Number(createForm.maxScore.replace(',', '.'));
      if (!Number.isFinite(n) || n < 1) {
        setErr('El puntaje máximo debe ser un número mayor o igual a 1.');
        return;
      }
      body.maxScore = Math.round(n * 100) / 100;
    }
    if (createForm.dueDate.trim()) body.dueDate = createForm.dueDate.trim();

    setCreating(true);
    try {
      await api.post('/api/v1/activities', body);
      setShowCreate(false);
      setInfo('Actividad creada correctamente.');
      await loadActivities();
    } catch (e) {
      setErr(getUserFacingMessage(e));
    } finally {
      setCreating(false);
    }
  };

  const loadBoard = useCallback(async (id: string) => {
    setLoadingBoard(true);
    setErr(null);
    try {
      const { data } = await api.get<BoardResponse>(`/api/v1/activities/${id}`);
      setBoard(data);
      const next: Record<string, RowDraft> = {};
      for (const r of data.rows) {
        next[r.studentId] = r.grade
          ? { score: String(parseFloat(r.grade.score)), notes: r.grade.notes ?? '' }
          : { score: '', notes: '' };
      }
      setDrafts(next);
    } catch (e) {
      setErr(getUserFacingMessage(e));
      setBoard(null);
      setDrafts({});
    } finally {
      setLoadingBoard(false);
    }
  }, []);

  const openActivity = async (id: string) => {
    setSelectedActivityId(id);
    setInfo(null);
    await loadBoard(id);
  };

  const backToList = () => {
    setSelectedActivityId(null);
    setBoard(null);
    setDrafts({});
    void loadActivities();
  };

  const parseScore2Decimals = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const n = Number(trimmed.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) return null;
    if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-9) return null;
    return Math.round(n * 100) / 100;
  };

  const saveOne = async (studentId: string) => {
    if (!board) return;
    if (board.activity.status !== 'OPEN') return;
    const d = drafts[studentId];
    if (!d?.score?.trim()) {
      setErr('Ingrese una calificación numérica.');
      return;
    }
    const score = parseScore2Decimals(d.score);
    if (score === null) {
      setErr('Calificación no válida. Use números con hasta 2 decimales.');
      return;
    }
    const max = Number(board.activity.maxScore);
    if (Number.isFinite(max) && score > max) {
      setErr(`La calificación no puede superar ${max}.`);
      return;
    }
    setSavingId(studentId);
    setErr(null);
    try {
      await api.post(`/api/v1/activities/${board.activity.id}/grades`, {
        entries: [{ studentId, score, notes: d.notes?.trim() || undefined }]
      });
      await loadBoard(board.activity.id);
    } catch (e) {
      setErr(getUserFacingMessage(e));
    } finally {
      setSavingId(null);
    }
  };

  const saveAllFilled = async () => {
    if (!board) return;
    if (board.activity.status !== 'OPEN') return;
    const max = Number(board.activity.maxScore);
    const entries: Array<{ studentId: string; score: number; notes?: string }> = [];
    for (const r of board.rows) {
      const d = drafts[r.studentId];
      if (!d?.score?.trim()) continue;
      const score = parseScore2Decimals(d.score);
      if (score === null) {
        setErr(`Calificación no válida para ${r.fullName}. Use hasta 2 decimales.`);
        return;
      }
      if (Number.isFinite(max) && score > max) {
        setErr(`La calificación no puede superar ${max} (${r.fullName}).`);
        return;
      }
      entries.push({ studentId: r.studentId, score, notes: d.notes?.trim() || undefined });
    }
    if (entries.length === 0) {
      setErr('No hay filas con calificación para guardar.');
      return;
    }
    setSavingAll(true);
    setErr(null);
    try {
      await api.post(`/api/v1/activities/${board.activity.id}/grades`, { entries });
      await loadBoard(board.activity.id);
    } catch (e) {
      setErr(getUserFacingMessage(e));
    } finally {
      setSavingAll(false);
    }
  };

  const closeActivity = async () => {
    if (!board) return;
    if (!window.confirm('¿Cerrar la actividad? Las notas quedarán bloqueadas hasta que la reabras.')) return;
    setBusyAction(true);
    setErr(null);
    try {
      await api.post(`/api/v1/activities/${board.activity.id}/close`);
      setInfo('Actividad cerrada. Las calificaciones quedan publicadas.');
      await loadBoard(board.activity.id);
    } catch (e) {
      setErr(getUserFacingMessage(e));
    } finally {
      setBusyAction(false);
    }
  };

  const reopenActivity = async () => {
    if (!board) return;
    if (!window.confirm('¿Reabrir la actividad para editar calificaciones?')) return;
    setBusyAction(true);
    setErr(null);
    try {
      await api.post(`/api/v1/activities/${board.activity.id}/reopen`);
      setInfo('Actividad reabierta. Puedes editar calificaciones.');
      await loadBoard(board.activity.id);
    } catch (e) {
      setErr(getUserFacingMessage(e));
    } finally {
      setBusyAction(false);
    }
  };

  const deleteActivityFromList = async (id: string) => {
    if (!window.confirm('¿Eliminar esta actividad? Esta acción no se puede deshacer.')) return;
    setErr(null);
    try {
      await api.delete(`/api/v1/activities/${id}`);
      setInfo('Actividad eliminada.');
      await loadActivities();
    } catch (e) {
      setErr(getUserFacingMessage(e));
    }
  };

  const updateDraft = (studentId: string, patch: Partial<RowDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [studentId]: {
        score: prev[studentId]?.score ?? '',
        notes: prev[studentId]?.notes ?? '',
        ...patch
      }
    }));
  };

  const isClosed = board?.activity.status === 'CLOSED';

  return (
    <div className="max-w-6xl animate-fade-in space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Actividades y calificaciones</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          Cree <strong>actividades</strong> para sus grupos y califique a cada estudiante. Al terminar, <strong>cierre</strong>{' '}
          la actividad para publicar las notas y bloquear ediciones. Si necesita corregir, puede <strong>reabrirla</strong>{' '}
          en cualquier momento.
        </p>
      </div>

      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {err}
        </div>
      )}
      {info && !err && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          {info}
        </div>
      )}

      {!selectedActivityId && (
        <>
          <section className="rounded border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {platformAdmin && (
                  <label className="block text-sm">
                    <span className="text-slate-700">Institución</span>
                    <div className="mt-1">
                      <SmartSelect
                        options={schoolFilterOptions}
                        value={schoolFilter}
                        onChange={setSchoolFilter}
                        placeholder="Todas las instituciones"
                        disabled={loadingAssignments}
                      />
                    </div>
                  </label>
                )}
                <label className="block text-sm">
                  <span className="text-slate-700">Grupo y materia</span>
                  <div className="mt-1">
                    <SmartSelect
                      options={filterAssignmentOptions}
                      value={filterAssignment}
                      onChange={setFilterAssignment}
                      disabled={loadingAssignments}
                      placeholder={
                        assignments.length === 0 ? 'Sin asignaciones' : 'Todos mis grupos/materias'
                      }
                    />
                  </div>
                </label>
                <label className="block text-sm">
                  <span className="text-slate-700">Periodo</span>
                  <div className="mt-1">
                    <SmartSelect
                      options={filterPeriodOptions}
                      value={filterPeriod}
                      onChange={setFilterPeriod}
                      placeholder="Todos los periodos"
                    />
                  </div>
                </label>
                <label className="block text-sm">
                  <span className="text-slate-700">Estado</span>
                  <select
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as '' | ActivityStatus)}
                  >
                    <option value="">Todos</option>
                    <option value="OPEN">Abiertas</option>
                    <option value="CLOSED">Cerradas</option>
                  </select>
                </label>
              </div>
              <button
                type="button"
                onClick={openCreate}
                disabled={assignments.length === 0}
                className="rounded border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Crear actividad
              </button>
            </div>
          </section>

          <section className="rounded border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Actividades
              </h2>
              <button
                type="button"
                onClick={() => void loadActivities()}
                disabled={loadingActivities}
                className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {loadingActivities ? 'Actualizando…' : 'Actualizar'}
              </button>
            </div>
            {loadingActivities ? (
              <p className="p-4 text-sm text-slate-500">Cargando…</p>
            ) : activities.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">
                No hay actividades con los filtros seleccionados. Cree una nueva con el botón anterior.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {activities.map((a) => (
                  <li key={a.id} className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-slate-900">{a.title}</p>
                        <StatusBadge status={a.status} />
                        {a.underReview && <ReviewBadge />}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {a.schoolName ? `${a.schoolName} · ` : ''}
                        {a.groupName ?? 'Grupo'} · {a.grade ?? '—'} · {a.schoolYear ?? '—'} ·{' '}
                        <span className="font-medium text-slate-700">{a.subjectName}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Periodo: {a.periodName ?? a.period} · Máx: {parseFloat(a.maxScore)} ·{' '}
                        {a.dueDate ? `Entrega: ${a.dueDate} · ` : ''}
                        Calificados: {a.gradedCount}/{a.rosterCount}
                        {a.status === 'CLOSED' && a.closedAt
                          ? ` · Cerrada ${new Date(a.closedAt).toLocaleDateString('es')}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void openActivity(a.id)}
                        className="rounded border border-brand-800 bg-white px-3 py-1.5 text-xs font-medium text-brand-900 hover:bg-slate-50"
                      >
                        {a.status === 'OPEN' ? 'Calificar' : 'Ver notas'}
                      </button>
                      {a.gradedCount === 0 && (
                        <button
                          type="button"
                          onClick={() => void deleteActivityFromList(a.id)}
                          className="rounded border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {selectedActivityId && (
        <section className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={backToList}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  ← Volver
                </button>
                {board && (
                  <>
                    <p className="truncate text-sm font-semibold text-slate-900">{board.activity.title}</p>
                    <StatusBadge status={board.activity.status} />
                    {board.activity.underReview && <ReviewBadge />}
                  </>
                )}
              </div>
              {board && (
                <p className="mt-1 text-xs text-slate-600">
                  {board.activity.subjectName} · Periodo {board.activity.period} · Máx{' '}
                  {parseFloat(board.activity.maxScore)}
                  {board.activity.dueDate ? ` · Entrega ${board.activity.dueDate}` : ''}
                  {board.activity.closedAt
                    ? ` · Cerrada ${new Date(board.activity.closedAt).toLocaleString('es')}`
                    : ''}
                </p>
              )}
              {board?.activity.description && (
                <p className="mt-1 max-w-3xl text-xs text-slate-600">{board.activity.description}</p>
              )}
            </div>
            {board && (
              <div className="flex flex-wrap items-center gap-2">
                {board.activity.status === 'OPEN' ? (
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={() => void closeActivity()}
                    className="rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {busyAction ? 'Procesando…' : 'Cerrar actividad'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={() => void reopenActivity()}
                    className="rounded border border-amber-600 bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                  >
                    {busyAction ? 'Procesando…' : 'Reabrir actividad'}
                  </button>
                )}
              </div>
            )}
          </div>

          {loadingBoard ? (
            <p className="p-4 text-sm text-slate-500">Cargando tablero…</p>
          ) : board ? (
            <>
              {isClosed && (
                <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-900">
                  Esta actividad está cerrada. Las calificaciones no se pueden editar hasta reabrirla.
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-white">
                      <th className="px-3 py-2 font-semibold text-slate-700">Estudiante</th>
                      <th className="px-3 py-2 font-semibold text-slate-700">Matrícula</th>
                      <th className="px-3 py-2 font-semibold text-slate-700">Calificación</th>
                      <th className="min-w-[12rem] px-3 py-2 font-semibold text-slate-700">
                        Observación (opcional)
                      </th>
                      <th className="px-3 py-2 font-semibold text-slate-700">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.rows.map((r) => {
                      const d = drafts[r.studentId] ?? { score: '', notes: '' };
                      const hasGrade = Boolean(r.grade);
                      return (
                        <tr key={r.studentId} className="border-b border-slate-100">
                          <td className="px-3 py-2 text-slate-900">{r.fullName}</td>
                          <td className="px-3 py-2 text-slate-600">{r.matricula}</td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              disabled={isClosed}
                              className="w-24 rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100 disabled:text-slate-500"
                              value={d.score}
                              onChange={(e) => updateDraft(r.studentId, { score: e.target.value })}
                              aria-label={`Calificación ${r.fullName}`}
                            />
                            {hasGrade ? (
                              <span className="ml-2 text-xs text-emerald-700">Registrada</span>
                            ) : (
                              <span className="ml-2 text-xs text-amber-700">Pendiente</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              disabled={isClosed}
                              className="w-full min-w-[10rem] rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100 disabled:text-slate-500"
                              value={d.notes}
                              onChange={(e) => updateDraft(r.studentId, { notes: e.target.value })}
                              placeholder="Breve comentario"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              disabled={savingId === r.studentId || isClosed}
                              onClick={() => void saveOne(r.studentId)}
                              className="rounded border border-brand-800 bg-white px-2 py-1 text-xs font-medium text-brand-900 hover:bg-slate-50 disabled:opacity-50"
                            >
                              {savingId === r.studentId ? 'Guardando…' : 'Guardar'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
                <p className="text-xs text-slate-500">
                  Las filas con calificación se pueden guardar en lote. Al cerrar la actividad las notas quedan publicadas.
                </p>
                {!isClosed && (
                  <button
                    type="button"
                    disabled={savingAll}
                    onClick={() => void saveAllFilled()}
                    className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {savingAll ? 'Guardando lote…' : 'Guardar todas las filas completadas'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="p-4 text-sm text-slate-500">No se pudo cargar el tablero.</p>
          )}
        </section>
      )}

      {showCreate && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !creating) setShowCreate(false);
          }}
        >
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Nueva actividad</h3>
              <button
                type="button"
                onClick={() => !creating && setShowCreate(false)}
                className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 px-4 py-4">
              <label className="block text-sm">
                <span className="text-slate-700">Grupo y materia</span>
                <div className="mt-1">
                  <SmartSelect
                    options={assignmentSelectOptions}
                    value={createForm.assignmentKey}
                    onChange={(v) => setCreateForm((f) => ({ ...f, assignmentKey: v }))}
                    disabled={loadingAssignments || assignments.length === 0}
                    placeholder={
                      assignments.length === 0 ? 'Sin asignaciones' : '— Elegir grupo y materia —'
                    }
                  />
                </div>
              </label>
              <label className="block text-sm">
                <span className="text-slate-700">Título de la actividad</span>
                <input
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Ej. Examen unidad 2, Proyecto final"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-slate-700">Periodo académico</span>
                  <div className="mt-1">
                    <SmartSelect
                      options={activePeriodOptions}
                      value={createForm.periodId}
                      onChange={(v) => setCreateForm((f) => ({ ...f, periodId: v }))}
                      placeholder={
                        activePeriodOptions.length === 0
                          ? 'No hay periodos ACTIVOS'
                          : '— Elegir periodo —'
                      }
                      disabled={activePeriodOptions.length === 0}
                    />
                  </div>
                </label>
                <label className="block text-sm">
                  <span className="text-slate-700">Puntaje máximo</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    value={createForm.maxScore}
                    onChange={(e) => setCreateForm((f) => ({ ...f, maxScore: e.target.value }))}
                    placeholder={
                      selectedCreateAssignment?.schoolMaxGradeScale
                        ? `Predeterminado ${parseFloat(selectedCreateAssignment.schoolMaxGradeScale)}`
                        : '100'
                    }
                  />
                </label>
              </div>
              <label className="block text-sm">
                <span className="text-slate-700">Fecha de entrega (opcional)</span>
                <input
                  type="date"
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  value={createForm.dueDate}
                  onChange={(e) => setCreateForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-700">Descripción (opcional)</span>
                <textarea
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Instrucciones, criterios, etc."
                  value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
              <button
                type="button"
                onClick={() => !creating && setShowCreate(false)}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                disabled={creating}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void submitCreate()}
                disabled={creating}
                className="rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {creating ? 'Creando…' : 'Crear actividad'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewBadge() {
  return (
    <span
      title="Actividad reabierta tras haberse publicado. Las notas visibles quedan 'en revisión' hasta que se vuelva a cerrar."
      className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900"
    >
      En revisión
    </span>
  );
}

function StatusBadge({ status }: { status: ActivityStatus }) {
  if (status === 'OPEN') {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
        Abierta
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">
      Cerrada
    </span>
  );
}
