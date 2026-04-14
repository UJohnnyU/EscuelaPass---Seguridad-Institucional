import { type FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { useAuth } from '@/context/useAuth';
import { isPlatformAdmin } from '@/lib/roles';

type TeacherGroup = {
  id: string;
  name: string;
  grade: string | null;
  schoolYear: string | null;
  schoolId?: string;
};
type SchoolRow = { id: string; name: string; code: string };
type RosterStudent = { studentId: string; matricula: string; fullName: string };
type AttentionNoteRow = {
  id: string;
  studentId: string;
  studentName: string;
  matricula: string;
  severity: 'LEVE' | 'MODERADA' | 'GRAVE';
  title: string;
  description: string;
  occurredAt: string;
  createdAt: string;
  createdByName: string;
};

const SEVERITY_LABEL: Record<string, string> = {
  LEVE: 'Leve',
  MODERADA: 'Moderada',
  GRAVE: 'Grave'
};

export function AnotacionesDocentePage() {
  const { user } = useAuth();
  const platformAdmin = isPlatformAdmin(user);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [schoolFilter, setSchoolFilter] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [groups, setGroups] = useState<TeacherGroup[]>([]);
  const [groupId, setGroupId] = useState('');
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [notes, setNotes] = useState<AttentionNoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [studentId, setStudentId] = useState('');
  const [severity, setSeverity] = useState<'LEVE' | 'MODERADA' | 'GRAVE'>('LEVE');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [occurredAt, setOccurredAt] = useState('');

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
      setLoading(true);
      setErr(null);
      try {
        if (platformAdmin) {
          const params = schoolFilter.trim() ? { schoolId: schoolFilter.trim() } : undefined;
          const { data } = await api.get<TeacherGroup[]>('/api/v1/school/groups', { params });
          if (cancelled) return;
          const list = Array.isArray(data) ? data : [];
          setGroups(list);
          if (list.length > 0) {
            setGroupId((g) => g || list[0].id);
          }
        } else {
          const { data } = await api.get<TeacherGroup[]>('/api/v1/schedules/me/teacher/groups');
          if (cancelled) return;
          const list = Array.isArray(data) ? data : [];
          setGroups(list);
          if (list.length > 0) {
            setGroupId((g) => g || list[0].id);
          }
        }
      } catch (e) {
        if (!cancelled) setErr(getUserFacingMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [platformAdmin, schoolFilter]);

  const loadGroupData = async (gid: string) => {
    if (!gid) {
      setStudents([]);
      setNotes([]);
      return;
    }
    setErr(null);
    try {
      const [attRes, notesRes] = await Promise.all([
        api.get<{ students: RosterStudent[] }>(`/api/v1/attendance/groups/${gid}`),
        api.get<AttentionNoteRow[]>(`/api/v1/attention-notes/teacher/groups/${gid}`)
      ]);
      setStudents(attRes.data.students ?? []);
      setNotes(Array.isArray(notesRes.data) ? notesRes.data : []);
      setStudentId((sid) => {
        const roster = attRes.data.students ?? [];
        if (sid && roster.some((s) => s.studentId === sid)) return sid;
        return roster[0]?.studentId ?? '';
      });
    } catch (e) {
      setErr(getUserFacingMessage(e));
      setStudents([]);
      setNotes([]);
    }
  };

  useEffect(() => {
    if (!groupId) return;
    void loadGroupData(groupId);
  }, [groupId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!studentId || !title.trim() || !description.trim()) {
      setErr('Seleccione estudiante y complete título y descripción.');
      return;
    }
    setSaving(true);
    setErr(null);
    setOk(null);
    try {
      await api.post('/api/v1/attention-notes', {
        studentId,
        severity,
        title: title.trim(),
        description: description.trim(),
        ...(occurredAt ? { occurredAt: new Date(occurredAt).toISOString() } : {})
      });
      setOk('Anotación registrada. La familia recibirá un aviso en su bandeja de notificaciones.');
      setTitle('');
      setDescription('');
      setOccurredAt('');
      await loadGroupData(groupId);
    } catch (errSubmit) {
      setErr(getUserFacingMessage(errSubmit));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl animate-fade-in space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Anotaciones a estudiantes</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Registre observaciones o llamados de atención vinculados a un alumno. Si el estudiante tiene familia
          vinculada en el sistema, se genera automáticamente una <strong>notificación</strong> para los tutores
          (misma bandeja que otros avisos institucionales).
        </p>
      </div>

      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {err}
        </div>
      )}
      {ok && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          {ok}
        </div>
      )}

      <section className="rounded border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Nueva anotación</h2>
        {loading ? (
          <p className="mt-4 text-sm text-slate-600">Cargando grupos…</p>
        ) : groups.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            {platformAdmin
              ? 'No hay grupos para el filtro elegido. Seleccione otra institución o verifique los datos en Escuelas.'
              : 'No tiene grupos asignados para registrar anotaciones.'}
          </p>
        ) : (
          <form className="mt-4 space-y-4" onSubmit={(e) => void submit(e)}>
            <div className="grid gap-4 sm:grid-cols-2">
              {platformAdmin && (
                <label className="block text-sm sm:col-span-2">
                  <span className="text-slate-700">Institución (filtro)</span>
                  <select
                    className="mt-1 w-full max-w-md rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={schoolFilter}
                    onChange={(e) => setSchoolFilter(e.target.value)}
                  >
                    <option value="">Todas las instituciones</option>
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block text-sm">
                <span className="text-slate-700">Grupo</span>
                <select
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {platformAdmin && g.schoolId
                        ? `${schools.find((s) => s.id === g.schoolId)?.name ?? ''} · `
                        : ''}
                      {g.name} · {g.grade ?? '—'} · {g.schoolYear ?? '—'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-slate-700">Estudiante</span>
                <select
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  disabled={students.length === 0}
                >
                  {students.length === 0 ? (
                    <option value="">Sin estudiantes en el grupo</option>
                  ) : (
                    students.map((s) => (
                      <option key={s.studentId} value={s.studentId}>
                        {s.fullName} ({s.matricula})
                      </option>
                    ))
                  )}
                </select>
              </label>
            </div>
            <label className="block text-sm">
              <span className="text-slate-700">Gravedad</span>
              <select
                className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm sm:max-w-xs"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as 'LEVE' | 'MODERADA' | 'GRAVE')}
              >
                <option value="LEVE">{SEVERITY_LABEL.LEVE}</option>
                <option value="MODERADA">{SEVERITY_LABEL.MODERADA}</option>
                <option value="GRAVE">{SEVERITY_LABEL.GRAVE}</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Título breve</span>
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Comportamiento en clase, entrega de tarea…"
                maxLength={200}
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Descripción</span>
              <textarea
                className="mt-1 min-h-[100px] w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalle objetivo de la situación y, si aplica, acuerdos con el estudiante."
                maxLength={3000}
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Fecha del hecho (opcional)</span>
              <input
                type="datetime-local"
                className="mt-1 w-full max-w-sm rounded border border-slate-300 px-3 py-2 text-sm"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || !studentId}
                className="rounded border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Guardando…' : 'Registrar y notificar familia'}
              </button>
              <span className="text-xs text-slate-500">
                Si no hay tutor vinculado al alumno, la anotación queda guardada sin envío de aviso.
              </span>
            </div>
          </form>
        )}
      </section>

      {groupId && notes.length > 0 && (
        <section className="rounded border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Anotaciones recientes en este grupo</h2>
            <p className="text-xs text-slate-500">Incluye registros de todo el personal autorizado.</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {notes.map((n) => (
              <li key={n.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-slate-900">
                    {n.studentName}{' '}
                    <span className="font-normal text-slate-600">({n.matricula})</span>
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {SEVERITY_LABEL[n.severity] ?? n.severity}
                  </span>
                </div>
                <p className="mt-1 font-medium text-slate-800">{n.title}</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-600">{n.description}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {n.createdByName} ·{' '}
                  {new Date(n.occurredAt).toLocaleString(undefined, {
                    dateStyle: 'short',
                    timeStyle: 'short'
                  })}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
