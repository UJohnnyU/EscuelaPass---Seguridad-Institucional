import { useEffect, useMemo, useState } from 'react';
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

type ActivityBoardResponse = {
  groupId: string;
  subject: string;
  period: string;
  assessmentName: string;
  maxScore: number | null;
  rows: Array<{
    studentId: string;
    matricula: string;
    fullName: string;
    grade: {
      id: string;
      score: string;
      maxScore: string;
      notes: string | null;
      gradedAt: string;
    } | null;
  }>;
};

type RowDraft = { score: string; notes: string };

export function CalificacionesDocentePage() {
  const { user } = useAuth();
  const platformAdmin = isPlatformAdmin(user);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [schoolFilter, setSchoolFilter] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);

  const [selectedKey, setSelectedKey] = useState<string>('');
  const [period, setPeriod] = useState('');
  const [assessmentName, setAssessmentName] = useState('');
  const [maxScore, setMaxScore] = useState('100');

  const [board, setBoard] = useState<ActivityBoardResponse | null>(null);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});

  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  const selected = useMemo(() => {
    if (!selectedKey) return null;
    const [groupId, subjectId] = selectedKey.split('::');
    return assignments.find((a) => a.groupId === groupId && a.subjectId === subjectId) ?? null;
  }, [assignments, selectedKey]);

  useEffect(() => {
    if (!selected?.schoolMaxGradeScale) return;
    const n = Number(selected.schoolMaxGradeScale);
    if (Number.isFinite(n) && n >= 1) {
      setMaxScore((Math.round(n * 100) / 100).toFixed(2));
    }
  }, [selected?.schoolMaxGradeScale]);

  const schoolFilterOptions = useMemo(
    () => [
      { value: '', label: 'Todas las instituciones' },
      ...schools.map((s) => ({ value: s.id, label: `${s.name} (${s.code})`, searchText: s.code }))
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
        const { data } = await api.get<TeacherAssignment[]>('/api/v1/grades/teacher/my-assignments', {
          params
        });
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setAssignments(list);
        if (list.length > 0) {
          setSelectedKey((k) => k || `${list[0].groupId}::${list[0].subjectId}`);
        }
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

  const syncDraftsFromBoard = (b: ActivityBoardResponse) => {
    const next: Record<string, RowDraft> = {};
    const max = b.maxScore != null ? String(b.maxScore) : maxScore;
    for (const r of b.rows) {
      if (r.grade) {
        next[r.studentId] = {
          score: String(parseFloat(r.grade.score)),
          notes: r.grade.notes ?? ''
        };
      } else {
        next[r.studentId] = { score: '', notes: '' };
      }
    }
    setDrafts(next);
    if (b.maxScore != null) setMaxScore(String(b.maxScore));
    else setMaxScore(max);
  };

  const loadBoard = async () => {
    if (!selected) {
      setErr('Seleccione grupo y materia.');
      return;
    }
    const p = period.trim();
    const an = assessmentName.trim();
    if (!p || !an) {
      setErr('Indique período evaluativo y nombre de la actividad.');
      return;
    }
    setLoadingBoard(true);
    setErr(null);
    try {
      const { data } = await api.get<ActivityBoardResponse>('/api/v1/grades/teacher/activity-board', {
        params: {
          groupId: selected.groupId,
          period: p,
          subject: selected.subjectName,
          assessmentName: an
        }
      });
      setBoard(data);
      syncDraftsFromBoard(data);
    } catch (e) {
      setErr(getUserFacingMessage(e));
      setBoard(null);
      setDrafts({});
    } finally {
      setLoadingBoard(false);
    }
  };

  const parseMax = (): number => {
    const n = Number(maxScore.replace(',', '.'));
    return Number.isFinite(n) && n >= 1 ? Math.round(n * 100) / 100 : 100;
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
    if (!selected || !board) return;
    const d = drafts[studentId];
    if (!d?.score.trim()) {
      setErr('Ingrese una calificación numérica.');
      return;
    }
    const score = parseScore2Decimals(String(d.score));
    if (score === null) {
      setErr('Calificación no válida. Debe ser un número entre 0 y el máximo, con hasta 2 decimales.');
      return;
    }
    const max = parseMax();
    if (score > max) {
      setErr(`La calificación no puede superar ${max}.`);
      return;
    }
    setSavingId(studentId);
    setErr(null);
    try {
      await api.post('/api/v1/grades/register', {
        studentId,
        subject: selected.subjectName,
        period: board.period,
        assessmentName: board.assessmentName,
        score,
        maxScore: max,
        notes: d.notes?.trim() || undefined
      });
      await loadBoard();
    } catch (e) {
      setErr(getUserFacingMessage(e));
    } finally {
      setSavingId(null);
    }
  };

  const saveAllFilled = async () => {
    if (!selected || !board) return;
    const max = parseMax();
    const entries: { studentId: string; score: number; notes?: string }[] = [];
    for (const r of board.rows) {
      const d = drafts[r.studentId];
      if (!d?.score?.trim()) continue;
      const score = parseScore2Decimals(String(d.score));
      if (score === null) {
        setErr(`Calificación no válida para ${r.fullName}. Use hasta 2 decimales.`);
        return;
      }
      if (score > max) {
        setErr(`La calificación no puede superar ${max} (${r.fullName}).`);
        return;
      }
      entries.push({
        studentId: r.studentId,
        score,
        notes: d.notes?.trim() || undefined
      });
    }
    if (entries.length === 0) {
      setErr('No hay calificaciones numéricas para guardar. Complete al menos una fila.');
      return;
    }
    setSavingAll(true);
    setErr(null);
    try {
      await api.post('/api/v1/grades/teacher/register-batch', {
        groupId: selected.groupId,
        subject: selected.subjectName,
        period: board.period,
        assessmentName: board.assessmentName,
        maxScore: max,
        entries
      });
      await loadBoard();
    } catch (e) {
      setErr(getUserFacingMessage(e));
    } finally {
      setSavingAll(false);
    }
  };

  const updateDraft = (studentId: string, patch: Partial<RowDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [studentId]: { score: prev[studentId]?.score ?? '', notes: prev[studentId]?.notes ?? '', ...patch }
    }));
  };

  return (
    <div className="max-w-5xl animate-fade-in space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Calificaciones por actividad</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Defina un <strong>período evaluativo</strong> y el <strong>nombre de la actividad</strong> (único para todo el
          grupo en esa materia). Luego cargue la lista, califique alumno por alumno y guarde cada fila o use guardado en
          lote para las filas completadas.
        </p>
      </div>

      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {err}
        </div>
      )}

      <section className="rounded border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Parámetros de la actividad</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {platformAdmin && (
            <label className="block text-sm sm:col-span-2">
              <span className="text-slate-700">Institución (filtro)</span>
              <div className="mt-1 max-w-md">
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
                options={assignmentSelectOptions}
                value={selectedKey}
                onChange={setSelectedKey}
                disabled={loadingAssignments || assignments.length === 0}
                placeholder={assignments.length === 0 ? 'Sin asignaciones' : '— Elegir grupo y materia —'}
                emptyLabel="Sin asignaciones"
              />
            </div>
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Período evaluativo</span>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Ej. 2026-2027 · Bim. 1"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-slate-700">Nombre de la actividad o evaluación</span>
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Ej. Examen escrito unidad 2, Proyecto integrador…"
              value={assessmentName}
              onChange={(e) => setAssessmentName(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Puntaje máximo</span>
            <input
              type="text"
              inputMode="decimal"
              className="mt-1 w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              value={maxScore}
              readOnly
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadBoard()}
            disabled={loadingBoard || !selected}
            className="rounded border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingBoard ? 'Cargando…' : 'Cargar lista de estudiantes'}
          </button>
        </div>
      </section>

      {board && (
        <section className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-sm font-medium text-slate-800">
              {board.subject} · {board.period} · {board.assessmentName}
            </p>
            <p className="text-xs text-slate-500">
              Escala: 0 a {parseMax()} puntos. Las notas se almacenan con trazabilidad (fecha de registro en servidor).
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-white">
                  <th className="px-3 py-2 font-semibold text-slate-700">Estudiante</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">Matrícula</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">Calificación</th>
                  <th className="min-w-[12rem] px-3 py-2 font-semibold text-slate-700">Observación (opcional)</th>
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
                          className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
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
                          className="w-full min-w-[10rem] rounded border border-slate-300 px-2 py-1 text-sm"
                          value={d.notes}
                          onChange={(e) => updateDraft(r.studentId, { notes: e.target.value })}
                          placeholder="Breve comentario"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          disabled={savingId === r.studentId}
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
              Use &quot;Guardar&quot; para una fila o guarde varias a la vez con el botón siguiente (solo filas con
              calificación ingresada).
            </p>
            <button
              type="button"
              disabled={savingAll}
              onClick={() => void saveAllFilled()}
              className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              {savingAll ? 'Guardando lote…' : 'Guardar todas las filas completadas'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
