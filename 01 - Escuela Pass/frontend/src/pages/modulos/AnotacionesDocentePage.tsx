import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { DATA_TABLE_SEARCH_INPUT, SCROLLABLE_PANEL_BODY } from '@/components/DataTableScroll';
import { SmartSelect } from '@/components/SmartSelect';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { createSchoolGroupsLoadOptions, createTeacherMyGroupsLoadOptions } from '@/lib/schoolGroupsSelect';
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
  const [groupId, setGroupId] = useState('');
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [notes, setNotes] = useState<AttentionNoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [notesSearch, setNotesSearch] = useState('');

  const [studentId, setStudentId] = useState('');
  const [severity, setSeverity] = useState<'LEVE' | 'MODERADA' | 'GRAVE'>('LEVE');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [occurredAt, setOccurredAt] = useState('');

  const schoolFilterOptions = useMemo(
    () => [
      { value: '', label: 'Todas las instituciones' },
      ...schools.map((s) => ({ value: s.id, label: `${s.name} (${s.code})`, searchText: s.code }))
    ],
    [schools]
  );

  const loadGroupOptions = useMemo(() => {
    if (platformAdmin) {
      return createSchoolGroupsLoadOptions({
        schoolId: schoolFilter.trim() || undefined,
        schools,
        showSchoolPrefix: !schoolFilter.trim()
      });
    }
    return createTeacherMyGroupsLoadOptions(schools, false);
  }, [platformAdmin, schoolFilter, schools]);

  const [groupLabelHint, setGroupLabelHint] = useState('');

  const refreshGroupLabelHint = useCallback(
    async (gid: string) => {
      if (!gid) {
        setGroupLabelHint('');
        return;
      }
      try {
        let g: TeacherGroup | undefined;
        if (platformAdmin) {
          // ADMIN de plataforma puede usar el endpoint de school (tiene acceso)
          const { data } = await api.get<TeacherGroup>(`/api/v1/school/groups/${gid}`);
          g = data;
        } else {
          // DOCENTE: usar el endpoint accesible para docentes y encontrar el grupo por ID
          const { data } = await api.get<TeacherGroup[]>('/api/v1/schedules/me/teacher/groups', {
            params: { limit: '200' }
          });
          g = Array.isArray(data) ? data.find((x) => x.id === gid) : undefined;
        }
        if (!g) { setGroupLabelHint(''); return; }
        const schoolName = g.schoolId ? schools.find((s) => s.id === g.schoolId)?.name : undefined;
        const prefix = platformAdmin && schoolName ? `${schoolName} · ` : '';
        setGroupLabelHint(`${prefix}${g.name} · ${g.grade ?? '—'} · ${g.schoolYear ?? '—'}`);
      } catch {
        setGroupLabelHint('');
      }
    },
    [platformAdmin, schools]
  );

  const studentSelectOptions = useMemo(
    () =>
      students.map((s) => ({
        value: s.studentId,
        label: `${s.fullName} (${s.matricula})`,
        searchText: s.matricula
      })),
    [students]
  );

  const filteredNotes = useMemo(() => {
    const q = notesSearch.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) =>
      [
        n.studentName,
        n.matricula,
        n.title,
        n.description,
        n.createdByName,
        SEVERITY_LABEL[n.severity] ?? n.severity
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [notes, notesSearch]);

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
    const ac = new AbortController();
    let cancelled = false;
    setLoading(true);
    setErr(null);
    loadGroupOptions('', ac.signal)
      .then((rows) => {
        if (cancelled) return;
        if (rows.length > 0) {
          setGroupId((g) => (g && rows.some((r) => r.value === g) ? g : rows[0].value));
        } else {
          setGroupId('');
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const aborted =
          e &&
          typeof e === 'object' &&
          'name' in e &&
          ((e as { name?: string }).name === 'CanceledError' || (e as { name?: string }).name === 'AbortError');
        if (!aborted) setErr(getUserFacingMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [loadGroupOptions, platformAdmin, schoolFilter]);

  useEffect(() => {
    void refreshGroupLabelHint(groupId);
  }, [groupId, refreshGroupLabelHint]);

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

  useEffect(() => {
    setNotesSearch('');
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
          Registre observaciones o llamados de atención de un alumno. Si su familia está registrada en el sistema,
          recibirá un aviso en la misma bandeja donde llegan los demás comunicados de la escuela.
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
        ) : !groupId && !loading ? (
          <p className="mt-4 text-sm text-slate-600">
            {platformAdmin
              ? 'No hay grupos para mostrar. Cambie de escuela o revise que los grupos estén creados.'
              : 'Aún no tiene grupos asignados para registrar anotaciones.'}
          </p>
        ) : (
          <form className="mt-4 space-y-4" onSubmit={(e) => void submit(e)}>
            <div className="grid gap-4 sm:grid-cols-2">
              {platformAdmin && (
                <label className="flex flex-col gap-2 text-sm sm:col-span-2">
                  <span className="text-slate-700">Institución (filtro)</span>
                  <div className="max-w-md">
                    <SmartSelect
                      options={schoolFilterOptions}
                      value={schoolFilter}
                      onChange={setSchoolFilter}
                      placeholder="Todas las instituciones"
                    />
                  </div>
                </label>
              )}
              <label className="flex flex-col gap-2 text-sm">
                <span className="text-slate-700">Grupo</span>
                <div>
                  <SmartSelect
                    loadOptions={loadGroupOptions}
                    value={groupId}
                    onChange={setGroupId}
                    placeholder="— Elegir grupo —"
                    selectedLabel={groupLabelHint || undefined}
                  />
                </div>
              </label>
              <label className="flex flex-col gap-2 text-sm">
                <span className="text-slate-700">Estudiante</span>
                <div>
                  <SmartSelect
                    options={studentSelectOptions}
                    value={studentId}
                    onChange={setStudentId}
                    disabled={students.length === 0}
                    placeholder={students.length === 0 ? 'Sin estudiantes en el grupo' : '— Elegir estudiante —'}
                    emptyLabel="Sin estudiantes en el grupo"
                  />
                </div>
              </label>
            </div>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-slate-700">Gravedad</span>
              <select
                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm sm:max-w-xs"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as 'LEVE' | 'MODERADA' | 'GRAVE')}
              >
                <option value="LEVE">{SEVERITY_LABEL.LEVE}</option>
                <option value="MODERADA">{SEVERITY_LABEL.MODERADA}</option>
                <option value="GRAVE">{SEVERITY_LABEL.GRAVE}</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-slate-700">Título breve</span>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Comportamiento en clase, entrega de tarea…"
                maxLength={200}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-slate-700">Descripción</span>
              <textarea
                className="min-h-[100px] w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalle objetivo de la situación y, si aplica, acuerdos con el estudiante."
                maxLength={3000}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-slate-700">Fecha del hecho (opcional)</span>
              <input
                type="datetime-local"
                className="w-full max-w-sm rounded border border-slate-300 px-3 py-2 text-sm"
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
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Anotaciones recientes en este grupo</h2>
              <p className="text-xs text-slate-500">Incluye registros de todo el personal autorizado.</p>
            </div>
            <label className="block w-full sm:max-w-xs">
              <span className="sr-only">Buscar anotaciones</span>
              <input
                type="search"
                value={notesSearch}
                onChange={(e) => setNotesSearch(e.target.value)}
                placeholder="Buscar alumno, título, autor…"
                className={DATA_TABLE_SEARCH_INPUT}
              />
            </label>
          </div>
          {filteredNotes.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">Ninguna anotación coincide con la búsqueda.</p>
          ) : (
            <div className={SCROLLABLE_PANEL_BODY}>
              <ul className="divide-y divide-slate-100">
                {filteredNotes.map((n) => (
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
            </div>
          )}
        </section>
      )}
    </div>
  );
}
