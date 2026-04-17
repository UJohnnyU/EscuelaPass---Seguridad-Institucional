import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FinanzasStaffTools } from '@/components/finanzas/FinanzasStaffTools';
import { type SmartSelectOption, SmartSelect } from '@/components/SmartSelect';
import { Panel, ValueView } from '@/components/ValueView';
import { useAuth } from '@/context/useAuth';
import { hasRole, isAdmin, isStaff } from '@/lib/roles';
import axios from 'axios';

type TeacherGroupRow = { id: string; name: string; grade: string | null; schoolYear: string };
type TeacherAttendanceStudentRow = { studentId: string; matricula: string; fullName: string };
type TeacherAttendanceRecordRow = {
  id: string;
  studentId: string;
  status: 'PRESENTE' | 'AUSENTE' | 'RETARDO';
  isJustified: boolean | null;
  notes: string | null;
  attendanceDate: string;
};

type DayAttendanceResponse = {
  view: 'day';
  date: string;
  canEdit: boolean;
  nonInstructionalDay: boolean;
  reasons?: string[];
  records: TeacherAttendanceRecordRow[];
  students: TeacherAttendanceStudentRow[];
};

type RangeAttendanceResponse = {
  view: 'range';
  dateFrom: string;
  dateTo: string;
  dates: string[];
  canEdit: false;
  records: TeacherAttendanceRecordRow[];
  students: TeacherAttendanceStudentRow[];
};

function todayISODateLocal(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, '0');
  const d = String(n.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function computeAttendanceQuery(
  period: 'day' | 'week' | 'month',
  refDate: string
): { kind: 'day'; date: string } | { kind: 'range'; from: string; to: string } {
  if (period === 'day') return { kind: 'day', date: refDate };
  const [y, m, d] = refDate.split('-').map((x) => Number.parseInt(x, 10));
  const dt = new Date(y, m - 1, d);
  if (period === 'week') {
    const day = dt.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(dt);
    mon.setDate(mon.getDate() + diff);
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    return { kind: 'range', from: toISODate(mon), to: toISODate(sun) };
  }
  const first = new Date(dt.getFullYear(), dt.getMonth(), 1);
  const last = new Date(dt.getFullYear(), dt.getMonth() + 1, 0);
  return { kind: 'range', from: toISODate(first), to: toISODate(last) };
}

function formatShortISODate(iso: string): string {
  const p = iso.slice(0, 10).split('-');
  if (p.length < 3) return iso;
  return `${p[2]}/${p[1]}`;
}

function attendanceRecordAbbrev(r: TeacherAttendanceRecordRow | undefined): string {
  if (!r) return '—';
  if (r.status === 'PRESENTE') return 'P';
  if (r.status === 'RETARDO') return 'R';
  if (r.status === 'AUSENTE') return r.isJustified ? 'Ae' : 'Af';
  return '—';
}

function shiftISODateLocal(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map((x) => Number.parseInt(x, 10));
  const dt = new Date(y, m - 1, d + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

type DocenteCalRow = { id: string; exceptionDate: string; reason: string | null; groupId: string | null };

export function ModulosHubPage() {
  const { user } = useAuth();
  const cards: { to: string; title: string; desc: string; show: boolean }[] = [
    {
      to: '/app/modulos/comunicacion',
      title: 'Comunicación',
      desc: 'Comunicados institucionales y bandeja de avisos.',
      show: true
    },
    {
      to: '/app/modulos/finanzas',
      title: 'Finanzas y pagos',
      desc: 'Conceptos, deudas y comprobantes según su perfil.',
      show: true
    },
    {
      to: '/app/gestion-escolar',
      title: 'Grupos y personas',
      desc: 'Alta de grupos, alumnos, docentes, padres y asignaciones en su escuela.',
      show: hasRole(user, 'ADMIN', 'ADMINISTRATIVO')
    },
    {
      to: '/app/modulos/academico',
      title: 'Académico',
      desc: 'Asistencia y calificaciones vinculadas a su cuenta.',
      show: hasRole(user, 'ALUMNO', 'PADRE', 'DOCENTE', 'ADMINISTRATIVO')
    },
    {
      to: '/app/modulos/calificaciones-docente',
      title: 'Calificaciones (docente)',
      desc: 'Actividades por grupo y materia: nombre de evaluación y notas alumno por alumno.',
      show: hasRole(user, 'DOCENTE', 'ADMIN')
    },
    {
      to: '/app/modulos/anotaciones-docente',
      title: 'Anotaciones a alumnos',
      desc: 'Registre observaciones; la familia recibe aviso en notificaciones.',
      show: hasRole(user, 'DOCENTE', 'ADMIN')
    },
    {
      to: '/app/modulos/visitas',
      title: 'Visitas y reuniones',
      desc: 'Visitas al plantel y citas con docentes.',
      show: hasRole(user, 'PADRE', 'DOCENTE', 'ADMIN', 'ADMINISTRATIVO')
    },
    {
      to: '/app/modulos/administracion',
      title: 'Administración e informes',
      desc: 'Tablero, auditoría, informes y calendario administrativo.',
      show: isAdmin(user) || hasRole(user, 'DOCENTE', 'ADMINISTRATIVO')
    },
    {
      to: '/app/modulos/herramientas',
      title: 'Herramientas',
      desc: 'Horarios, vehículos, privacidad y documentos PDF.',
      show: isStaff(user)
    },
    {
      to: '/app/horario',
      title: user?.role === 'ALUMNO' ? 'Mi horario' : 'Horarios',
      desc:
        user?.role === 'ALUMNO'
          ? 'Horario semanal del grupo, calendario sin clases y avisos recibidos.'
          : 'Consulte horarios por institución y grupo; calendario de días sin clases.',
      show: hasRole(user, 'ALUMNO', 'ADMIN', 'ADMINISTRATIVO')
    }
  ];

  return (
    <div className="max-w-5xl animate-fade-in">
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-slate-900">Módulos operativos</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
        Acceda a cada área para revisar datos en tiempo real. La información se presenta de forma clara; los errores
        se muestran como mensajes comprensibles.
      </p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {cards
          .filter((c) => c.show)
          .map((c) => (
            <li key={c.to}>
              <Link
                to={c.to}
                className="flex h-full flex-col rounded border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow"
              >
                <span className="font-medium text-slate-900">{c.title}</span>
                <span className="mt-2 flex-1 text-sm text-slate-600">{c.desc}</span>
                <span className="mt-4 text-xs font-semibold uppercase tracking-wide text-brand-800">Abrir</span>
              </Link>
            </li>
          ))}
      </ul>
    </div>
  );
}

export function ComunicacionPage() {
  type SchoolGroupRow = { id: string; name: string; grade: string | null; schoolYear: string };
  type StudentRow = { id: string; userId: string; fullName: string; email: string; matricula: string };
  type TeacherRow = { id: string; userId: string; fullName: string; email: string };
  type ParentRow = { id: string; userId: string; fullName: string; email: string };

  const [notifications, setNotifications] = useState<unknown>(null);
  const [notices, setNotices] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetMode, setTargetMode] = useState<'ROLE' | 'GROUP' | 'USER'>('ROLE');
  const [audience, setAudience] = useState<'ALL' | 'ADMINISTRATIVO' | 'DOCENTE' | 'PADRE' | 'ALUMNO'>('ALL');
  const [targetGroupId, setTargetGroupId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [important, setImportant] = useState(false);
  const { user } = useAuth();
  const staff = hasRole(user, 'ADMIN', 'ADMINISTRATIVO', 'DOCENTE');
  const canManageSchoolWideNotices = hasRole(user, 'ADMIN', 'ADMINISTRATIVO');

  const loadGroupOptions = useCallback(async (q: string, signal: AbortSignal) => {
    const { data } = await api.get<SchoolGroupRow[]>('/api/v1/school/groups', {
      params: { q: q.trim() || undefined, limit: 80 },
      signal
    });
    const rows = Array.isArray(data) ? data : [];
    return rows.map(
      (g): SmartSelectOption => ({
        value: g.id,
        label: `${g.name}${g.grade ? ` (${g.grade})` : ''} - ${g.schoolYear}`
      })
    );
  }, []);

  const loadNoticeTargetUsers = useCallback(async (q: string, signal: AbortSignal) => {
    const params = { q: q.trim() || undefined, limit: 50 };
    const [sRes, tRes, pRes] = await Promise.all([
      api.get<StudentRow[]>('/api/v1/school/students', { params, signal }),
      api.get<TeacherRow[]>('/api/v1/school/teachers', { params, signal }),
      api.get<ParentRow[]>('/api/v1/school/parents', { params, signal })
    ]);
    const out: SmartSelectOption[] = [];
    (Array.isArray(sRes.data) ? sRes.data : []).forEach((x) =>
      out.push({
        value: x.userId,
        label: `${x.fullName} — Alumno (${x.email})`,
        searchText: x.matricula
      })
    );
    (Array.isArray(tRes.data) ? tRes.data : []).forEach((x) =>
      out.push({ value: x.userId, label: `${x.fullName} — Docente (${x.email})` })
    );
    (Array.isArray(pRes.data) ? pRes.data : []).forEach((x) =>
      out.push({ value: x.userId, label: `${x.fullName} — Padre (${x.email})` })
    );
    out.sort((a, b) => a.label.localeCompare(b.label, 'es'));
    return out;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      try {
        const n = await api.get('/api/v1/notifications/me');
        if (!cancelled) setNotifications(n.data);
        if (staff) {
          const o = await api.get('/api/v1/notices?page=1&limit=10');
          if (!cancelled) setNotices(o.data);
        }
      } catch (e) {
        if (!cancelled) setErr(getUserFacingMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [staff]);

  async function onCreateNotice(e: FormEvent) {
    e.preventDefault();
    if (!staff || !canManageSchoolWideNotices) return;
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        content: content.trim(),
        isImportant: important
      };
      if (targetMode === 'ROLE') {
        payload.targetType = 'ALL';
        payload.targetRole = audience === 'ALL' ? undefined : audience;
      } else if (targetMode === 'GROUP') {
        payload.targetType = 'GROUP';
        payload.targetGroupId = targetGroupId;
      } else {
        payload.targetType = 'USER';
        payload.targetUserId = targetUserId;
      }
      await api.post('/api/v1/notices', payload);
      setTitle('');
      setContent('');
      setAudience('ALL');
      setTargetGroupId('');
      setTargetUserId('');
      setImportant(false);
      setMsg('Aviso escolar enviado.');
      const o = await api.get('/api/v1/notices?page=1&limit=10');
      setNotices(o.data);
    } catch (e2) {
      setErr(getUserFacingMessage(e2, 'No se pudo enviar el aviso.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Comunicación</h1>
        <p className="mt-1 text-sm text-slate-600">Notificaciones personales y, si aplica, comunicados emitidos.</p>
      </div>
      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>
      )}
      <Panel title="Mis notificaciones" description="Avisos entregados a su usuario.">
        <ValueView data={notifications} />
      </Panel>
      {staff && (
        <>
          <Panel
            title="Emitir aviso escolar"
            description="Envío por audiencia, grupo específico o usuario específico."
          >
            {canManageSchoolWideNotices ? (
              <form className="grid gap-3 sm:grid-cols-2" onSubmit={onCreateNotice}>
              <label className="text-sm sm:col-span-2">
                <span className="text-slate-700">Título</span>
                <input
                  required
                  maxLength={255}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="text-slate-700">Contenido</span>
                <textarea
                  required
                  rows={4}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </label>
              {canManageSchoolWideNotices ? (
                <>
                  <label className="text-sm">
                    <span className="text-slate-700">Tipo de destino</span>
                    <select
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                      value={targetMode}
                      onChange={(e) => setTargetMode(e.target.value as 'ROLE' | 'GROUP' | 'USER')}
                    >
                      <option value="ROLE">Por audiencia</option>
                      <option value="GROUP">Grupo específico</option>
                      <option value="USER">Usuario específico</option>
                    </select>
                  </label>
                  {targetMode === 'ROLE' && (
                    <label className="text-sm">
                      <span className="text-slate-700">Audiencia</span>
                      <select
                        className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                        value={audience}
                        onChange={(e) =>
                          setAudience(e.target.value as 'ALL' | 'ADMINISTRATIVO' | 'DOCENTE' | 'PADRE' | 'ALUMNO')
                        }
                      >
                        <option value="ALL">General (toda la comunidad)</option>
                        <option value="ADMINISTRATIVO">Solo administrativos</option>
                        <option value="DOCENTE">Solo docentes</option>
                        <option value="PADRE">Solo padres</option>
                        <option value="ALUMNO">Solo alumnos</option>
                      </select>
                    </label>
                  )}
                  {targetMode === 'GROUP' && (
                    <label className="text-sm">
                      <span className="text-slate-700">Grupo</span>
                      <div className="mt-1">
                        <SmartSelect
                          loadOptions={loadGroupOptions}
                          value={targetGroupId}
                          onChange={setTargetGroupId}
                          placeholder="— Elegir grupo —"
                        />
                      </div>
                    </label>
                  )}
                  {targetMode === 'USER' && (
                    <label className="text-sm">
                      <span className="text-slate-700">Usuario</span>
                      <div className="mt-1">
                        <SmartSelect
                          loadOptions={loadNoticeTargetUsers}
                          value={targetUserId}
                          onChange={setTargetUserId}
                          placeholder="— Elegir usuario —"
                        />
                      </div>
                    </label>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-600 sm:col-span-2">
                  Esta versión permite envío detallado (audiencia/grupo/usuario) para administración.
                </p>
              )}
              <label className="mt-6 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} />
                Marcar como importante
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
                >
                  Enviar aviso
                </button>
              </div>
              </form>
            ) : (
              <p className="text-sm text-slate-600">
                La emisión de avisos se habilita para administración del plantel.
              </p>
            )}
            {msg && <p className="mt-3 text-sm text-emerald-700">{msg}</p>}
          </Panel>
          <Panel title="Comunicados (gestión)" description="Listado reciente para personal autorizado.">
            <ValueView data={notices} />
          </Panel>
        </>
      )}
    </div>
  );
}

export function FinanzasPage() {
  const [concepts, setConcepts] = useState<unknown>(null);
  const [debts, setDebts] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);
  const { user } = useAuth();
  const padre = user?.role === 'PADRE';
  const admin = isAdmin(user);

  useEffect(() => {
    if (admin) return;
    let cancelled = false;
    (async () => {
      setErr(null);
      try {
        const c = await api.get('/api/v1/payments/concepts');
        if (!cancelled) setConcepts(c.data);
        if (padre) {
          const d = await api.get('/api/v1/payments/debts/mine');
          if (!cancelled) setDebts(d.data);
        }
      } catch (e) {
        if (!cancelled) setErr(getUserFacingMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [padre, admin]);

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Finanzas</h1>
        <p className="mt-1 text-sm text-slate-600">Conceptos de cobro y estado de obligaciones según su rol.</p>
      </div>
      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>
      )}
      {admin && (
        <div>
          <h2 className="font-serif text-lg font-semibold text-slate-900">Gestión (administración)</h2>
          <p className="mt-1 text-sm text-slate-600">
            Personal administrativo y administradores pueden crear y editar conceptos, y asignar colegiaturas u otras
            obligaciones a alumnos de la institución.
          </p>
          <div className="mt-4">
            <FinanzasStaffTools />
          </div>
        </div>
      )}
      {!admin && (
        <Panel title="Conceptos">
          <ValueView data={concepts} />
        </Panel>
      )}
      {padre && (
        <Panel title="Mis obligaciones">
          <ValueView data={debts} />
        </Panel>
      )}
    </div>
  );
}

export function AcademicoPage() {
  const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
  const weekRangeISO = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  };
  type ParentScheduleSlot = {
    id: string;
    weekday: number;
    startTime: string;
    endTime: string;
    room: string | null;
    subjectName: string | null;
  };
  type ParentScheduleChild = {
    studentId: string;
    studentName: string;
    groupId: string | null;
    group: { id: string; name: string | null; grade: string | null; schoolYear: string | null } | null;
    slots: ParentScheduleSlot[];
  };
  type ParentCalendarChild = {
    studentId: string;
    studentName: string;
    groupId: string | null;
    days: Array<{ id: string; exceptionDate: string; reason: string | null }>;
  };
  const [att, setAtt] = useState<unknown>(null);
  const [grades, setGrades] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);
  const [childrenSchedule, setChildrenSchedule] = useState<ParentScheduleChild[] | null>(null);
  const [childrenCalendar, setChildrenCalendar] = useState<ParentCalendarChild[] | null>(null);
  const [childrenNotifications, setChildrenNotifications] = useState<unknown>(null);
  const [attentionNotes, setAttentionNotes] = useState<unknown>(null);
  const [myNotifications, setMyNotifications] = useState<unknown>(null);
  const [meetings, setMeetings] = useState<unknown>(null);
  const [teacherGroups, setTeacherGroups] = useState<TeacherGroupRow[]>([]);
  const [selectedTeacherGroupId, setSelectedTeacherGroupId] = useState<string>('');
  const [attendancePeriod, setAttendancePeriod] = useState<'day' | 'week' | 'month'>('day');
  const [attendanceRefDate, setAttendanceRefDate] = useState(() => todayISODateLocal());
  const [attendanceStudentFilter, setAttendanceStudentFilter] = useState('');
  const [teacherAttendance, setTeacherAttendance] = useState<DayAttendanceResponse | RangeAttendanceResponse | null>(
    null
  );
  const [savingAttendanceStudentId, setSavingAttendanceStudentId] = useState<string | null>(null);
  const [docenteGroupCal, setDocenteGroupCal] = useState<DocenteCalRow[]>([]);
  const [docenteSuspendDate, setDocenteSuspendDate] = useState(() => todayISODateLocal());
  const [docenteSuspendReason, setDocenteSuspendReason] = useState('');
  const [docenteCalSaving, setDocenteCalSaving] = useState(false);
  const [docenteCalRemoving, setDocenteCalRemoving] = useState<string | null>(null);
  const [pendingDocenteCalRemoval, setPendingDocenteCalRemoval] = useState<{ id: string; label: string } | null>(null);
  const { user, ready } = useAuth();
  const padre = user?.role === 'PADRE';
  const alumno = user?.role === 'ALUMNO';
  const docente = user?.role === 'DOCENTE';
  const verAsistenciaGrupos = docente || user?.role === 'ADMINISTRATIVO';
  const { from, to } = useMemo(() => weekRangeISO(), []);
  const teacherGroupSelectOptions = useMemo(
    () =>
      teacherGroups.map((g) => ({
        value: g.id,
        label: `${g.name} · ${g.grade ?? '—'} · ${g.schoolYear}`,
        searchText: `${g.name} ${g.grade ?? ''} ${g.schoolYear}`
      })),
    [teacherGroups]
  );

  const attendanceStudentSelectOptions = useMemo(() => {
    const rows = teacherAttendance?.students ?? [];
    const opts: SmartSelectOption[] = [{ value: '', label: 'Todos' }];
    for (const s of rows) {
      opts.push({
        value: s.studentId,
        label: `${s.fullName} (${s.matricula})`,
        searchText: s.matricula
      });
    }
    return opts;
  }, [teacherAttendance?.students]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      try {
        if (padre) {
          const [a, g, s, c, childNotifs, alerts, mineNotifs, m] = await Promise.all([
            api.get('/api/v1/attendance/parent/my-children'),
            Promise.resolve({ data: [] as unknown }),
            api.get<{ children: ParentScheduleChild[] }>('/api/v1/schedules/parent/my-children'),
            api.get<{ children: ParentCalendarChild[] }>(
              `/api/v1/calendar/parent/my-children?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
            ),
            api.get('/api/v1/notifications/parent/my-children?limit=25'),
            api.get('/api/v1/attention-notes/parent/my-children'),
            api.get('/api/v1/notifications/me?limit=25'),
            api.get('/api/v1/meetings/me')
          ]);
          if (!cancelled) {
            setAtt(a.data);
            setGrades(g.data);
            setChildrenSchedule(s.data.children ?? []);
            setChildrenCalendar(c.data.children ?? []);
            setChildrenNotifications(childNotifs.data);
            setAttentionNotes(alerts.data);
            setMyNotifications(mineNotifs.data);
            setMeetings(m.data);
          }
        }
        if (alumno) {
          if (!cancelled) {
            setAtt(null);
            setGrades(null);
            setChildrenSchedule(null);
            setChildrenCalendar(null);
            setChildrenNotifications(null);
            setAttentionNotes(null);
            setMyNotifications(null);
            setMeetings(null);
          }
        }
        if (verAsistenciaGrupos) {
          const groupsRes = await api.get<TeacherGroupRow[]>('/api/v1/schedules/me/teacher/groups');
          const groups = groupsRes.data ?? [];
          const groupId = groups[0]?.id ?? '';
          if (!cancelled) {
            setTeacherGroups(groups);
            setSelectedTeacherGroupId(groupId);
          }
          if (!groupId && !cancelled) {
            setTeacherAttendance(null);
          }
        }
      } catch (e) {
        if (!cancelled) setErr(getUserFacingMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [padre, alumno, verAsistenciaGrupos, from, to]);

  useEffect(() => {
    setAttendanceStudentFilter('');
  }, [selectedTeacherGroupId]);

  const loadTeacherAttendance = useCallback(
    async (groupId: string) => {
      if (!groupId) {
        setTeacherAttendance(null);
        return;
      }
      try {
        setErr(null);
        const q = computeAttendanceQuery(attendancePeriod, attendanceRefDate);
        const studentQ =
          attendanceStudentFilter.length > 0
            ? `&studentId=${encodeURIComponent(attendanceStudentFilter)}`
            : '';
        const path =
          q.kind === 'day'
            ? `/api/v1/attendance/groups/${groupId}?date=${encodeURIComponent(q.date)}${studentQ}`
            : `/api/v1/attendance/groups/${groupId}?from=${encodeURIComponent(q.from)}&to=${encodeURIComponent(q.to)}${studentQ}`;
        const attRes = await api.get<DayAttendanceResponse | RangeAttendanceResponse>(path);
        setTeacherAttendance(attRes.data);
      } catch (e) {
        setErr(getUserFacingMessage(e));
      }
    },
    [attendancePeriod, attendanceRefDate, attendanceStudentFilter]
  );

  useEffect(() => {
    if (!verAsistenciaGrupos || !selectedTeacherGroupId) {
      if (!selectedTeacherGroupId) setTeacherAttendance(null);
      return;
    }
    void loadTeacherAttendance(selectedTeacherGroupId);
  }, [verAsistenciaGrupos, selectedTeacherGroupId, loadTeacherAttendance]);

  const loadDocenteGroupCal = useCallback(async () => {
    if (!docente || !selectedTeacherGroupId) {
      setDocenteGroupCal([]);
      return;
    }
    try {
      const from = shiftISODateLocal(todayISODateLocal(), -7);
      const to = shiftISODateLocal(todayISODateLocal(), 120);
      const { data } = await api.get<DocenteCalRow[]>(
        `/api/v1/calendar/non-instructional-days?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&groupId=${encodeURIComponent(selectedTeacherGroupId)}`
      );
      setDocenteGroupCal(Array.isArray(data) ? data : []);
    } catch {
      setDocenteGroupCal([]);
    }
  }, [docente, selectedTeacherGroupId]);

  useEffect(() => {
    void loadDocenteGroupCal();
  }, [loadDocenteGroupCal]);

  if (!ready) {
    return <p className="text-slate-600">Cargando…</p>;
  }
  if (user && !padre && !alumno && !verAsistenciaGrupos) {
    return <Navigate to="/app/modulos" replace />;
  }

  const upsertAttendance = async (
    studentId: string,
    status: 'PRESENTE' | 'AUSENTE' | 'RETARDO',
    isJustified?: boolean
  ) => {
    if (!selectedTeacherGroupId) return;
    try {
      setErr(null);
      setSavingAttendanceStudentId(studentId);
      const body: Record<string, unknown> = {
        studentId,
        status,
        isJustified: status === 'AUSENTE' ? Boolean(isJustified) : undefined
      };
      if (teacherAttendance?.view === 'day') {
        body.attendanceDate = teacherAttendance.date;
      }
      await api.post('/api/v1/attendance/register', body);
      await loadTeacherAttendance(selectedTeacherGroupId);
    } catch (e) {
      setErr(getUserFacingMessage(e));
    } finally {
      setSavingAttendanceStudentId(null);
    }
  };

  const addDocenteGroupDayOff = async () => {
    if (!selectedTeacherGroupId || !docente) return;
    setDocenteCalSaving(true);
    setErr(null);
    try {
      await api.post('/api/v1/calendar/non-instructional-days', {
        exceptionDate: docenteSuspendDate,
        groupId: selectedTeacherGroupId,
        reason: docenteSuspendReason.trim() || undefined
      });
      setDocenteSuspendReason('');
      await loadDocenteGroupCal();
    } catch (e) {
      setErr(getUserFacingMessage(e));
    } finally {
      setDocenteCalSaving(false);
    }
  };

  const removeDocenteCal = async (id: string) => {
    setDocenteCalRemoving(id);
    setErr(null);
    try {
      await api.delete(`/api/v1/calendar/non-instructional-days/${id}`);
      await loadDocenteGroupCal();
    } catch (e) {
      setErr(getUserFacingMessage(e));
    } finally {
      setDocenteCalRemoving(null);
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Académico</h1>
        <p className="mt-1 text-sm text-slate-600">
          {padre
            ? 'Asistencia y calificaciones de los estudiantes vinculados a su cuenta.'
            : alumno
              ? 'Revise sus calificaciones y descargue boletines del período actual o anteriores.'
              : verAsistenciaGrupos
                ? docente
                  ? 'Registre la asistencia del día en los grupos donde tiene asignación.'
                  : 'Consulte la asistencia de todos los grupos y alumnos de su institución.'
                : 'Esta vista está orientada a familias. Docentes y administración usan informes y exportaciones.'}
        </p>
      </div>
      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>
      )}
      {padre ? (
        <>
          <Panel title="Asistencia (familia)">
            <ValueView data={att} />
          </Panel>
          <Panel
            title="Calificaciones de sus hijos"
            description="Las actividades cerradas por los docentes aparecen en el módulo dedicado."
          >
            <Link
              to="/app/modulos/mis-calificaciones"
              className="inline-flex items-center rounded border border-slate-900 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Ir a Mis calificaciones
            </Link>
          </Panel>
          <Panel
            title="Boletines de sus hijos"
            description="Los boletines de periodo y final se publican automáticamente al cerrar cada periodo."
          >
            <Link
              to="/app/modulos/boletines"
              className="inline-flex items-center rounded border border-slate-900 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Ver boletines
            </Link>
          </Panel>
          <Panel title="Horarios semanales de sus hijos">
            {!childrenSchedule || childrenSchedule.length === 0 ? (
              <p className="text-sm text-slate-600">No hay estudiantes vinculados a su cuenta.</p>
            ) : (
              <div className="space-y-5">
                {childrenSchedule.map((child) => {
                  const byDay = new Map<number, ParentScheduleSlot[]>();
                  for (const slot of child.slots ?? []) {
                    const list = byDay.get(slot.weekday) ?? [];
                    list.push(slot);
                    byDay.set(slot.weekday, list);
                  }
                  for (const wd of WEEKDAY_ORDER) {
                    const rows = byDay.get(wd);
                    if (rows) rows.sort((a, b) => a.startTime.localeCompare(b.startTime));
                  }
                  return (
                    <div key={child.studentId} className="rounded border border-slate-200 bg-white p-4">
                      <p className="font-semibold text-slate-900">{child.studentName}</p>
                      {child.group ? (
                        <p className="mt-1 text-xs text-slate-600">
                          Grupo {child.group.name ?? '—'} · {child.group.grade ?? '—'} · {child.group.schoolYear ?? '—'}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-amber-800">Sin grupo asignado.</p>
                      )}
                      {child.slots.length === 0 ? (
                        <p className="mt-3 text-sm text-slate-600">No hay franjas horarias registradas.</p>
                      ) : (
                        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                          <table className="min-w-full border-collapse text-left text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50">
                                <th className="px-3 py-2 font-semibold text-slate-700">Día</th>
                                <th className="px-3 py-2 font-semibold text-slate-700">Horario</th>
                                <th className="px-3 py-2 font-semibold text-slate-700">Materia</th>
                                <th className="px-3 py-2 font-semibold text-slate-700">Aula</th>
                              </tr>
                            </thead>
                            <tbody>
                              {WEEKDAY_ORDER.flatMap((wd) => {
                                const rows = byDay.get(wd) ?? [];
                                if (rows.length === 0) return [];
                                return rows.map((slot, i) => (
                                  <tr key={slot.id} className="border-b border-slate-100">
                                    {i === 0 ? (
                                      <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-800" rowSpan={rows.length}>
                                        {WEEKDAY_SHORT[wd]}
                                      </td>
                                    ) : null}
                                    <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                                      {slot.startTime.slice(0, 5)} - {slot.endTime.slice(0, 5)}
                                    </td>
                                    <td className="px-3 py-2 text-slate-800">{slot.subjectName ?? '—'}</td>
                                    <td className="px-3 py-2 text-slate-600">{slot.room ?? '—'}</td>
                                  </tr>
                                ));
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
          <Panel title="Eventos de sus hijos (calendario semanal)">
            <ValueView data={childrenCalendar} />
          </Panel>
          <Panel title="Avisos notificados para sus hijos">
            <ValueView data={childrenNotifications} />
          </Panel>
          <Panel title="Anotaciones y llamados de atención de sus hijos">
            <ValueView data={attentionNotes} />
          </Panel>
          <Panel title="Sus avisos personales">
            <ValueView data={myNotifications} />
          </Panel>
          <Panel title="Reuniones con docentes">
            <ValueView data={meetings} />
          </Panel>
        </>
      ) : alumno ? (
        <>
          <Panel
            title="Mis calificaciones"
            description="Las actividades cerradas por los docentes se muestran en el módulo dedicado."
          >
            <Link
              to="/app/modulos/mis-calificaciones"
              className="inline-flex items-center rounded border border-slate-900 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Ir a Mis calificaciones
            </Link>
          </Panel>
          <Panel
            title="Boletines"
            description="Los boletines se publican automáticamente al cerrar cada periodo académico."
          >
            <Link
              to="/app/modulos/boletines"
              className="inline-flex items-center rounded border border-slate-900 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Ver boletines
            </Link>
          </Panel>
        </>
      ) : verAsistenciaGrupos ? (
        <>
          <Panel
            title="Asistencia por grupo"
            description="Elija vista por día (registro), semana o mes (consulta). Puede filtrar por un estudiante."
          >
            {teacherGroups.length === 0 ? (
              <p className="text-sm text-slate-600">
                {docente
                  ? 'No tiene grupos asignados para registrar asistencia.'
                  : 'No hay grupos registrados en su institución.'}
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm text-slate-700">
                    Grupo
                    <div className="mt-0.5">
                      <SmartSelect
                        options={teacherGroupSelectOptions}
                        value={selectedTeacherGroupId}
                        onChange={setSelectedTeacherGroupId}
                        placeholder="— Elegir grupo —"
                      />
                    </div>
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-slate-700">
                    Vista
                    <select
                      className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                      value={attendancePeriod}
                      onChange={(e) => setAttendancePeriod(e.target.value as 'day' | 'week' | 'month')}
                    >
                      <option value="day">Día</option>
                      <option value="week">Semana</option>
                      <option value="month">Mes</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-slate-700">
                    Fecha de referencia
                    <input
                      type="date"
                      className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                      value={attendanceRefDate}
                      onChange={(e) => setAttendanceRefDate(e.target.value)}
                    />
                  </label>
                  <label className="flex min-w-[12rem] max-w-md flex-1 flex-col gap-1 text-sm text-slate-700">
                    Estudiante
                    <div className="mt-0.5">
                      <SmartSelect
                        options={attendanceStudentSelectOptions}
                        value={attendanceStudentFilter}
                        onChange={setAttendanceStudentFilter}
                        placeholder="Todos"
                      />
                    </div>
                  </label>
                </div>
                {teacherAttendance?.view === 'day' && teacherAttendance.nonInstructionalDay ? (
                  <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Día no lectivo
                    {teacherAttendance.reasons?.length ? `: ${teacherAttendance.reasons.join('; ')}` : '.'}
                  </div>
                ) : null}
                {!teacherAttendance ? (
                  <p className="text-sm text-slate-600">Cargando asistencia…</p>
                ) : teacherAttendance.view === 'range' ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600">
                      Del {formatShortISODate(teacherAttendance.dateFrom)} al {formatShortISODate(teacherAttendance.dateTo)}{' '}
                      ({teacherAttendance.dates.length} días). Vista de solo lectura; use la vista <strong>Día</strong> para
                      registrar o corregir.
                    </p>
                    <div className="overflow-x-auto rounded border border-slate-200">
                      <table className="min-w-full border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="sticky left-0 z-10 bg-slate-50 px-2 py-2 font-semibold text-slate-700">
                              Estudiante
                            </th>
                            {teacherAttendance.dates.map((d) => (
                              <th key={d} className="whitespace-nowrap px-1.5 py-2 text-center text-xs font-semibold text-slate-600">
                                {formatShortISODate(d)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {teacherAttendance.students.map((student) => {
                            const byDate = new Map<string, TeacherAttendanceRecordRow>();
                            for (const r of teacherAttendance.records) {
                              if (r.studentId === student.studentId) {
                                byDate.set(r.attendanceDate.slice(0, 10), r);
                              }
                            }
                            return (
                              <tr key={student.studentId} className="border-b border-slate-100">
                                <td className="sticky left-0 z-10 bg-white px-2 py-1.5 text-slate-900">{student.fullName}</td>
                                {teacherAttendance.dates.map((d) => (
                                  <td key={d} className="px-1 py-1.5 text-center text-xs text-slate-800">
                                    {attendanceRecordAbbrev(byDate.get(d))}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-slate-500">
                      Leyenda: P presente · R retardo · Af ausente falta · Ae ausente con excusa · — sin registro.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-600">
                      Fecha: <strong>{teacherAttendance.date}</strong>
                    </p>
                    <div className="overflow-x-auto rounded border border-slate-200">
                      <table className="min-w-full border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="px-3 py-2 font-semibold text-slate-700">Estudiante</th>
                            <th className="px-3 py-2 font-semibold text-slate-700">Matrícula</th>
                            <th className="px-3 py-2 font-semibold text-slate-700">Estado</th>
                            <th className="px-3 py-2 font-semibold text-slate-700">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teacherAttendance.students.map((student) => {
                            const current = teacherAttendance.records.find((r) => r.studentId === student.studentId);
                            const currentLabel =
                              !current
                                ? 'Sin registrar'
                                : current.status === 'AUSENTE'
                                  ? current.isJustified
                                    ? 'Ausente con excusa'
                                    : 'Ausente (falta)'
                                  : current.status === 'PRESENTE'
                                    ? 'Presente'
                                    : 'Retardo';
                            const disabled =
                              !teacherAttendance.canEdit ||
                              teacherAttendance.nonInstructionalDay ||
                              savingAttendanceStudentId === student.studentId;
                            return (
                              <tr key={student.studentId} className="border-b border-slate-100">
                                <td className="px-3 py-2 text-slate-900">{student.fullName}</td>
                                <td className="px-3 py-2 text-slate-700">{student.matricula}</td>
                                <td className="px-3 py-2 text-slate-700">{currentLabel}</td>
                                <td className="px-3 py-2">
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      disabled={disabled}
                                      onClick={() => void upsertAttendance(student.studentId, 'PRESENTE')}
                                      className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs text-emerald-800 disabled:opacity-50"
                                    >
                                      Presente
                                    </button>
                                    <button
                                      type="button"
                                      disabled={disabled}
                                      onClick={() => void upsertAttendance(student.studentId, 'RETARDO')}
                                      className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800 disabled:opacity-50"
                                    >
                                      Retardo
                                    </button>
                                    <button
                                      type="button"
                                      disabled={disabled}
                                      onClick={() => void upsertAttendance(student.studentId, 'AUSENTE', false)}
                                      className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-800 disabled:opacity-50"
                                    >
                                      Ausente (falta)
                                    </button>
                                    <button
                                      type="button"
                                      disabled={disabled}
                                      onClick={() => void upsertAttendance(student.studentId, 'AUSENTE', true)}
                                      className="rounded border border-sky-300 bg-sky-50 px-2 py-1 text-xs text-sky-800 disabled:opacity-50"
                                    >
                                      Ausente (excusa)
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {docente ? (
                      <p className="text-xs text-slate-500">
                        El docente solo puede modificar asistencias del día actual (vista Día).
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500">
                        En vista Día puede registrar o corregir según permisos; use Semana o Mes para revisar el historial.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </Panel>
          {docente && selectedTeacherGroupId ? (
            <Panel
              title="Día sin clases (solo este grupo)"
              description="Ese día no se toma asistencia para este grupo y no cuenta en los controles. Para toda la escuela debe hacerlo secretaría."
            >
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-sm text-slate-700">
                  Fecha
                  <input
                    type="date"
                    className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={docenteSuspendDate}
                    onChange={(e) => setDocenteSuspendDate(e.target.value)}
                  />
                </label>
                <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm text-slate-700">
                  Motivo (opcional)
                  <input
                    type="text"
                    className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={docenteSuspendReason}
                    onChange={(e) => setDocenteSuspendReason(e.target.value)}
                    placeholder="Ej. Evento deportivo"
                  />
                </label>
                <button
                  type="button"
                  disabled={docenteCalSaving}
                  onClick={() => void addDocenteGroupDayOff()}
                  className="rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {docenteCalSaving ? 'Guardando…' : 'Marcar día'}
                </button>
              </div>
              <div className="mt-6 space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Vigentes (referencia próximos meses)</p>
                {docenteGroupCal.length === 0 ? (
                  <p className="text-sm text-slate-600">No hay días marcados en el rango consultado.</p>
                ) : (
                  <ul className="space-y-2">
                    {docenteGroupCal.map((row) => {
                      const isGroup = row.groupId === selectedTeacherGroupId;
                      const label = !row.groupId ? 'Institución (toda la escuela)' : isGroup ? 'Este grupo' : 'Otro alcance';
                      return (
                        <li
                          key={row.id}
                          className="flex flex-wrap items-start justify-between gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          <div>
                            <span className="font-medium text-slate-900">
                              {String(row.exceptionDate).slice(0, 10)}
                            </span>
                            <span className="ml-2 text-xs text-slate-600">{label}</span>
                            {row.reason ? <span className="mt-0.5 block text-slate-600">{row.reason}</span> : null}
                          </div>
                          {isGroup ? (
                            <button
                              type="button"
                              disabled={docenteCalRemoving === row.id}
                              onClick={() =>
                                setPendingDocenteCalRemoval({
                                  id: row.id,
                                  label: `${String(row.exceptionDate).slice(0, 10)}${row.reason ? ` (${row.reason})` : ''}`
                                })
                              }
                              className="text-sm font-medium text-red-700 hover:underline disabled:opacity-50"
                            >
                              {docenteCalRemoving === row.id ? '…' : 'Quitar'}
                            </button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Panel>
          ) : null}
        </>
      ) : (
        <Panel title="Información">
          <p className="text-sm text-slate-600">
            Use el módulo <strong>Administración e informes</strong> para reportes por grupo o las exportaciones en
            Excel.
          </p>
        </Panel>
      )}
      <ConfirmDialog
        open={pendingDocenteCalRemoval !== null}
        title="Quitar día sin clases del grupo"
        description={
          pendingDocenteCalRemoval
            ? `Se quitará el registro "${pendingDocenteCalRemoval.label}" para este grupo.`
            : ''
        }
        confirmLabel="Sí, quitar"
        busy={docenteCalRemoving !== null}
        onCancel={() => setPendingDocenteCalRemoval(null)}
        onConfirm={() => {
          if (!pendingDocenteCalRemoval) return;
          void removeDocenteCal(pendingDocenteCalRemoval.id).finally(() => setPendingDocenteCalRemoval(null));
        }}
      />
    </div>
  );
}

export function VisitasPage() {
  const [visits, setVisits] = useState<unknown>(null);
  const [meetings, setMeetings] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);
  const { user } = useAuth();
  const padre = user?.role === 'PADRE';
  const staff = hasRole(user, 'DOCENTE', 'ADMIN', 'ADMINISTRATIVO');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      try {
        if (padre) {
          const [v, m] = await Promise.all([
            api.get('/api/v1/visits/me'),
            api.get('/api/v1/meetings/me')
          ]);
          if (!cancelled) {
            setVisits(v.data);
            setMeetings(m.data);
          }
        } else if (staff) {
          const [v, m] = await Promise.all([api.get('/api/v1/visits'), api.get('/api/v1/meetings')]);
          if (!cancelled) {
            setVisits(v.data);
            setMeetings(m.data);
          }
        }
      } catch (e) {
        if (!cancelled) setErr(getUserFacingMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [padre, staff]);

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Visitas y reuniones</h1>
        <p className="mt-1 text-sm text-slate-600">Solicitudes y seguimiento según corresponda a su rol.</p>
      </div>
      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>
      )}
      {!padre && !staff ? (
        <p className="text-sm text-slate-600">No hay datos disponibles para su perfil en esta sección.</p>
      ) : (
        <>
          <Panel title="Visitas">
            <ValueView data={visits} />
          </Panel>
          <Panel title="Reuniones padre–docente">
            <ValueView data={meetings} />
          </Panel>
        </>
      )}
    </div>
  );
}

export function AdministracionPage() {
  const [summary, setSummary] = useState<unknown>(null);
  const [audit, setAudit] = useState<unknown>(null);
  const [calendar, setCalendar] = useState<unknown>(null);
  const [repAtt, setRepAtt] = useState<unknown>(null);
  const [circuit, setCircuit] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);
  const { user } = useAuth();
  const admin = isAdmin(user);
  const docente = user?.role === 'DOCENTE';
  const administrativo = user?.role === 'ADMINISTRATIVO';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      try {
        if (admin) {
          const s = await api.get('/api/v1/dashboard/summary');
          const a = await api.get('/api/v1/audit/logs?limit=30');
          const cal = await api.get('/api/v1/calendar/non-instructional-days');
          if (!cancelled) {
            setSummary(s.data);
            setAudit(a.data);
            setCalendar(cal.data);
          }
        } else if (administrativo) {
          const cal = await api.get('/api/v1/calendar/non-instructional-days');
          if (!cancelled) setCalendar(cal.data);
        }
        if (admin || docente || administrativo) {
          const cToday = await api.get('/api/v1/reports/circuit/today');
          if (!cancelled) setCircuit(cToday.data);
          if (admin) {
            const rPay = await api.get('/api/v1/reports/payments/pending');
            if (!cancelled) setRepAtt(rPay.data);
          }
        }
      } catch (e) {
        if (!cancelled) setErr(getUserFacingMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [admin, docente, administrativo]);

  if (!admin && !docente && !administrativo) {
    return (
      <p className="text-sm text-slate-600">
        Esta sección es para personal autorizado. Si necesita un informe, solicítelo a secretaría.
      </p>
    );
  }

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Administración e informes</h1>
        <p className="mt-1 text-sm text-slate-600">Resumen operativo y trazas para evaluación en ejecución.</p>
      </div>
      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>
      )}
      {admin && (
        <>
          <Panel title="Tablero general">
            <ValueView data={summary} />
          </Panel>
          <Panel title="Auditoría reciente">
            <ValueView data={audit} />
          </Panel>
          <Panel title="Días no lectivos (calendario)">
            <ValueView data={calendar} />
          </Panel>
          <Panel title="Pagos pendientes (informe)">
            <ValueView data={repAtt} />
          </Panel>
        </>
      )}
      {administrativo && !admin ? (
        <Panel title="Días no lectivos (calendario de su escuela)">
          <ValueView data={calendar} />
          <p className="mt-3 text-sm text-slate-600">
            Para marcar o quitar días use <strong>Horarios</strong> en el menú (vista por grupo e institución).
          </p>
        </Panel>
      ) : null}
      <Panel title="Circuito del día (informe)">
        <ValueView data={circuit} />
      </Panel>
    </div>
  );
}

export function HerramientasPage() {
  const [privacy, setPrivacy] = useState<unknown>(null);
  const [policy, setPolicy] = useState<unknown>(null);
  const [policyHint, setPolicyHint] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<unknown>(null);
  const [schedule, setSchedule] = useState<unknown>(null);
  const [scheduleHint, setScheduleHint] = useState<string | null>(null);
  const [errAcceptances, setErrAcceptances] = useState<string | null>(null);
  const [errPolicy, setErrPolicy] = useState<string | null>(null);
  const [errVehicles, setErrVehicles] = useState<string | null>(null);
  const [errSchedule, setErrSchedule] = useState<string | null>(null);
  const { user } = useAuth();
  const padre = user?.role === 'PADRE';
  const docente = user?.role === 'DOCENTE';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErrAcceptances(null);
      setErrPolicy(null);
      setErrVehicles(null);
      setErrSchedule(null);
      setPolicyHint(null);
      setScheduleHint(null);
      try {
        const acc = await api.get('/api/v1/privacy/me/acceptances');
        if (!cancelled) setPrivacy(acc.data);
      } catch (e) {
        if (!cancelled) setErrAcceptances(getUserFacingMessage(e));
      }
      try {
        const pol = await api.get('/api/v1/privacy/policy/latest');
        if (!cancelled) setPolicy(pol.data);
      } catch (e) {
        if (axios.isAxiosError(e) && e.response?.status === 404) {
          if (!cancelled) {
            setPolicy(null);
            setPolicyHint('La institución aún no ha publicado el texto de política en el sistema.');
          }
        } else if (!cancelled) {
          setErrPolicy(getUserFacingMessage(e));
        }
      }
      try {
        if (padre) {
          const v = await api.get('/api/v1/parents/vehicles');
          if (!cancelled) setVehicles(v.data);
        }
      } catch (e) {
        if (!cancelled) setErrVehicles(getUserFacingMessage(e));
      }
      try {
        if (docente) {
          const s = await api.get('/api/v1/schedules/me/teacher');
          if (!cancelled) setSchedule(s.data);
        }
      } catch (e) {
        if (axios.isAxiosError(e) && e.response?.status === 403) {
          if (!cancelled) {
            setSchedule(null);
            setScheduleHint('No hay perfil docente asociado a esta cuenta. Contacte a secretaría.');
          }
        } else if (!cancelled) {
          setErrSchedule(getUserFacingMessage(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [padre, docente]);

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Herramientas</h1>
        <p className="mt-1 text-sm text-slate-600">
          Privacidad, horarios y vehículos según su perfil. Para importar o exportar archivos use el apartado
          correspondiente en el menú.
        </p>
      </div>
      <Panel title="Política de privacidad vigente" description="Texto institucional y tratamiento de datos.">
        {errPolicy && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{errPolicy}</div>
        )}
        {policyHint && <p className="mb-4 text-sm text-slate-600">{policyHint}</p>}
        <ValueView data={policy} />
      </Panel>
      <Panel title="Mis aceptaciones de privacidad">
        {errAcceptances && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {errAcceptances}
          </div>
        )}
        <ValueView data={privacy} />
      </Panel>
      {padre && (
        <Panel title="Vehículos registrados" description="Vehículos dados de alta para el circuito de recogida.">
          {errVehicles && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{errVehicles}</div>
          )}
          <ValueView data={vehicles} />
        </Panel>
      )}
      {docente && (
        <Panel title="Mis franjas de horario" description="Horario asignado en el sistema.">
          {errSchedule && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{errSchedule}</div>
          )}
          {scheduleHint && <p className="mb-4 text-sm text-amber-800">{scheduleHint}</p>}
          <ValueView data={schedule} />
        </Panel>
      )}
      <Panel title="Acceso al plantel">
        <p className="text-sm leading-relaxed text-slate-600">
          Su credencial QR de campus está en <strong>Mi perfil</strong>. El personal autorizado puede registrar
          ingresos en <strong>Escáner de acceso</strong>.
        </p>
      </Panel>
    </div>
  );
}
