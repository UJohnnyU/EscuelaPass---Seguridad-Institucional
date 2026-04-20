import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FinanzasStaffTools } from '@/components/finanzas/FinanzasStaffTools';
import { type SmartSelectOption, SmartSelect } from '@/components/SmartSelect';
import { Panel, ValueView } from '@/components/ValueView';
import {
  AttendanceChildrenView,
  ParentExcuseForm,
  AttentionNotesList,
  DebtsList,
  MeetingsList,
  NoticesList,
  NonInstructionalDaysList,
  NotificationsList,
  PaymentConceptsList,
  VehiclesList
} from '@/components/modulos/InfoCards';
import {
  buildWeekDays,
  WeekScheduleEvent,
  WeekScheduleGrid
} from '@/components/WeekScheduleGrid';
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
  const isTeacherOnly = user?.role === 'DOCENTE';

  useEffect(() => {
    if (isTeacherOnly && targetMode === 'ROLE') {
      setTargetMode('GROUP');
    }
  }, [isTeacherOnly, targetMode]);

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

  const loadTeacherGroupOptions = useCallback(async (q: string, signal: AbortSignal) => {
    const { data } = await api.get<TeacherGroupRow[]>('/api/v1/notices/teacher/groups', { signal });
    const rows = Array.isArray(data) ? data : [];
    const ql = q.trim().toLowerCase();
    return rows
      .filter((g) => {
        if (!ql) return true;
        const label = `${g.name} ${g.grade ?? ''} ${g.schoolYear}`.toLowerCase();
        return label.includes(ql);
      })
      .map(
        (g): SmartSelectOption => ({
          value: g.id,
          label: `${g.name}${g.grade ? ` (${g.grade})` : ''} · ${g.schoolYear}`
        })
      );
  }, []);

  const loadTeacherNoticeTargets = useCallback(async (q: string, signal: AbortSignal) => {
    const { data } = await api.get<
      Array<{ userId: string; fullName: string; email: string; kind: string }>
    >('/api/v1/notices/teacher/target-users', {
      params: q.trim() ? { q: q.trim() } : {},
      signal
    });
    const rows = Array.isArray(data) ? data : [];
    return rows.map(
      (x): SmartSelectOption => ({
        value: x.userId,
        label: `${x.fullName} — ${x.kind === 'PADRE' ? 'Padre/tutor' : 'Alumno'} (${x.email})`
      })
    );
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
    if (!staff) return;
    if (!canManageSchoolWideNotices && targetMode === 'ROLE') return;
    setSaving(true);
    setErr(null);
    setMsg(null);
    if (isTeacherOnly) {
      if (targetMode === 'GROUP' && !targetGroupId) {
        setErr('Seleccione el grupo al que desea enviar el aviso.');
        setSaving(false);
        return;
      }
      if (targetMode === 'USER' && !targetUserId) {
        setErr('Seleccione la persona destinataria.');
        setSaving(false);
        return;
      }
    }
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
        <p className="mt-1 text-sm text-slate-600">
          Sus avisos personales y los comunicados que publica la escuela.
        </p>
      </div>
      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>
      )}
      <Panel title="Mis notificaciones" description="Avisos que la escuela le ha enviado.">
        <NotificationsList data={notifications} allowMarkRead />
      </Panel>
      {staff && (
        <>
          <Panel
            title="Publicar un aviso"
            description={
              canManageSchoolWideNotices
                ? 'Envíelo a toda la comunidad, a un grupo o a una persona específica.'
                : 'Envíelo a uno de sus grupos o a una persona específica.'
            }
          >
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={onCreateNotice}>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-slate-700">Título</span>
                <input
                  required
                  maxLength={255}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block font-medium text-slate-700">Contenido</span>
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
                    <span className="mb-1 block font-medium text-slate-700">Tipo de destino</span>
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
                      <span className="mb-1 block font-medium text-slate-700">Audiencia</span>
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
                    <label className="text-sm sm:col-span-2">
                      <span className="mb-1 block font-medium text-slate-700">Grupo</span>
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
                    <label className="text-sm sm:col-span-2">
                      <span className="mb-1 block font-medium text-slate-700">Usuario</span>
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
              ) : isTeacherOnly ? (
                <>
                  <label className="text-sm sm:col-span-2">
                    <span className="mb-1 block font-medium text-slate-700">Destinatarios</span>
                    <select
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                      value={targetMode}
                      onChange={(e) => setTargetMode(e.target.value as 'ROLE' | 'GROUP' | 'USER')}
                    >
                      <option value="GROUP">Todo un grupo suyo</option>
                      <option value="USER">Una persona (alumno o padre de sus grupos)</option>
                    </select>
                  </label>
                  {targetMode === 'GROUP' && (
                    <label className="text-sm sm:col-span-2">
                      <span className="mb-1 block font-medium text-slate-700">Grupo</span>
                      <div className="mt-1">
                        <SmartSelect
                          loadOptions={loadTeacherGroupOptions}
                          value={targetGroupId}
                          onChange={setTargetGroupId}
                          placeholder="— Elegir grupo —"
                        />
                      </div>
                    </label>
                  )}
                  {targetMode === 'USER' && (
                    <label className="text-sm sm:col-span-2">
                      <span className="mb-1 block font-medium text-slate-700">Persona</span>
                      <div className="mt-1">
                        <SmartSelect
                          loadOptions={loadTeacherNoticeTargets}
                          value={targetUserId}
                          onChange={setTargetUserId}
                          placeholder="Buscar por nombre o correo…"
                        />
                      </div>
                    </label>
                  )}
                </>
              ) : null}
              <label className="mt-6 flex items-center gap-2 text-sm sm:col-span-2">
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
            {msg && <p className="mt-3 text-sm text-emerald-700">{msg}</p>}
          </Panel>
          <Panel
            title="Comunicados publicados"
            description={
              isTeacherOnly
                ? 'Los últimos avisos que usted ha publicado para sus grupos.'
                : 'Comunicados y avisos recientes de la institución.'
            }
          >
            <NoticesList data={notices} />
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
        <p className="mt-1 text-sm text-slate-600">
          Consulte sus pagos pendientes y los conceptos de cobro de la escuela.
        </p>
      </div>
      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>
      )}
      {admin && (
        <div>
          <h2 className="font-serif text-lg font-semibold text-slate-900">Gestión de cobros</h2>
          <p className="mt-1 text-sm text-slate-600">
            Cree o edite los conceptos de cobro de la escuela y asigne colegiaturas o pagos a los alumnos.
          </p>
          <div className="mt-4">
            <FinanzasStaffTools />
          </div>
        </div>
      )}
      {!admin && (
        <Panel
          title="Conceptos de cobro"
          description="Estos son los pagos vigentes que ha publicado la escuela."
        >
          <PaymentConceptsList data={concepts} />
        </Panel>
      )}
      {padre && (
        <Panel
          title="Mis pagos pendientes"
          description="Vea aquí lo que debe pagar y cuándo vence cada cobro."
        >
          <DebtsList data={debts} canUpload />
        </Panel>
      )}
    </div>
  );
}

export function AcademicoPage() {
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
  const [consentByStudent, setConsentByStudent] = useState<Record<string, boolean>>({});
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

  const parentExcuseStudents = useMemo(() => {
    if (!att || typeof att !== 'object') return [] as Array<{ studentId: string; studentName?: string; matricula?: string }>;
    const c = (att as { children?: unknown }).children;
    if (!Array.isArray(c)) return [];
    return c.map((ch) => {
      const row = ch as { studentId: string; studentName?: string; matricula?: string };
      return {
        studentId: row.studentId,
        studentName: row.studentName,
        matricula: row.matricula
      };
    });
  }, [att]);

  const reloadParentAttendance = useCallback(async () => {
    if (!padre) return;
    try {
      const a = await api.get('/api/v1/attendance/parent/my-children');
      setAtt(a.data);
    } catch (e) {
      setErr(getUserFacingMessage(e));
    }
  }, [padre]);

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

  useEffect(() => {
    if (!verAsistenciaGrupos || !selectedTeacherGroupId || !teacherAttendance || teacherAttendance.view !== 'day') {
      setConsentByStudent({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<Array<{ studentId: string; autonomous: boolean }>>(
          `/api/v1/departure-consent/staff/group/${selectedTeacherGroupId}?date=${encodeURIComponent(teacherAttendance.date)}`
        );
        if (!cancelled) {
          const m: Record<string, boolean> = {};
          for (const r of data ?? []) {
            if (r.autonomous) m[r.studentId] = true;
          }
          setConsentByStudent(m);
        }
      } catch {
        if (!cancelled) setConsentByStudent({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [verAsistenciaGrupos, selectedTeacherGroupId, teacherAttendance]);

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
  if (user && alumno) {
    return <Navigate to="/app/modulos/mis-calificaciones" replace />;
  }
  if (user && !padre && !verAsistenciaGrupos) {
    return <Navigate to="/app" replace />;
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
            ? 'Asistencia, calificaciones y horarios de sus hijos.'
            : alumno
              ? 'Vea sus calificaciones y descargue sus boletines.'
              : verAsistenciaGrupos
                ? docente
                  ? 'Tome asistencia diaria a los grupos que tiene a su cargo.'
                  : 'Consulte la asistencia de todos los grupos y alumnos de la escuela.'
                : 'Esta vista está pensada para familias y alumnos. La administración cuenta con informes y exportaciones.'}
        </p>
      </div>
      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>
      )}
      {padre ? (
        <>
          <Panel
            title="Asistencia de sus hijos"
            description="Resumen de asistencia y los últimos registros publicados por la escuela."
          >
            <AttendanceChildrenView data={att} />
          </Panel>
          <Panel
            title="Excusa de ausencia"
            description="Registre una ausencia con motivo y, si lo desea, adjunte un comprobante (PDF o imagen). Si ya hay asistencia marcada como presente o retardo ese día, deberá coordinar con secretaría."
          >
            <ParentExcuseForm students={parentExcuseStudents} onSuccess={reloadParentAttendance} />
          </Panel>
          <Panel
            title="Calificaciones de sus hijos"
            description="A medida que los docentes cierren cada actividad, sus calificaciones aparecerán aquí."
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
            description="Cada vez que la escuela cierra un periodo, los boletines quedan disponibles para descargar."
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
              <div className="space-y-6">
                {childrenSchedule.map((child) => {
                  const events: WeekScheduleEvent[] = (child.slots ?? []).map((s) => ({
                    id: s.id,
                    weekday: s.weekday,
                    startTime: s.startTime,
                    endTime: s.endTime,
                    title: s.subjectName ?? 'Clase',
                    subtitle: null,
                    room: s.room,
                    colorKey: s.subjectName ?? s.id
                  }));
                  const childCal = childrenCalendar?.find((c) => c.studentId === child.studentId);
                  const dayOff = new Map<string, string | null>();
                  for (const d of childCal?.days ?? []) {
                    const iso = String(d.exceptionDate).slice(0, 10);
                    if (iso >= from && iso <= to) {
                      dayOff.set(iso, d.reason ?? null);
                    }
                  }
                  return (
                    <div key={child.studentId} className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="font-semibold text-slate-900">{child.studentName}</p>
                      {child.group ? (
                        <p className="mt-1 text-xs text-slate-600">
                          Grupo {child.group.name ?? '—'} · {child.group.grade ?? '—'} · {child.group.schoolYear ?? '—'}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-amber-800">Sin grupo asignado.</p>
                      )}
                      <div className="mt-3">
                        <WeekScheduleGrid
                          events={events}
                          days={buildWeekDays(from, dayOff)}
                          emptyLabel="No hay franjas horarias registradas."
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
          <Panel
            title="Eventos y días sin clases (de la semana)"
            description="Días en los que la escuela suspende clases para sus hijos."
          >
            <NonInstructionalDaysList data={childrenCalendar} />
          </Panel>
          <Panel
            title="Avisos enviados a sus hijos"
            description="Notificaciones que la escuela envió directamente a sus hijos."
          >
            <NotificationsList
              data={childrenNotifications}
              emptyTitle="Sus hijos no tienen avisos recientes"
              emptyHint="Aquí aparecerán los avisos que la escuela les envíe."
            />
          </Panel>
          <Panel
            title="Llamados de atención y anotaciones"
            description="Observaciones registradas por docentes sobre sus hijos."
          >
            <AttentionNotesList data={attentionNotes} />
          </Panel>
          <Panel title="Sus avisos personales" description="Notificaciones dirigidas a usted.">
            <NotificationsList data={myNotifications} allowMarkRead />
          </Panel>
          <Panel title="Reuniones con docentes" description="Citas confirmadas o solicitudes de reunión.">
            <MeetingsList data={meetings} />
          </Panel>
        </>
      ) : alumno ? (
        <>
          <Panel
            title="Mis calificaciones"
            description="A medida que sus docentes cierren cada actividad, sus calificaciones aparecerán aquí."
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
            description="Cuando la escuela cierra un periodo, su boletín queda disponible para descargar."
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
            description="Use la vista de día para tomar o corregir asistencia. Las vistas de semana y mes son solo para consulta."
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
                    Este día no hay clases
                    {teacherAttendance.reasons?.length ? `: ${teacherAttendance.reasons.join('; ')}` : '.'}
                  </div>
                ) : null}
                {!teacherAttendance ? (
                  <p className="text-sm text-slate-600">Cargando asistencia…</p>
                ) : teacherAttendance.view === 'range' ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600">
                      Del {formatShortISODate(teacherAttendance.dateFrom)} al {formatShortISODate(teacherAttendance.dateTo)}{' '}
                      ({teacherAttendance.dates.length} días). Esta vista es solo para consultar. Para tomar o corregir
                      asistencia abra la vista <strong>Día</strong>.
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
                      Leyenda: P presente · R retardo · Af ausente sin justificar · Ae ausente con excusa · — sin
                      registro.
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
                                <td className="px-3 py-2 text-slate-900">
                                  <span className="align-middle">{student.fullName}</span>
                                  {consentByStudent[student.studentId] ? (
                                    <span className="ml-2 inline-flex align-middle rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-900">
                                      Salida autónoma hoy
                                    </span>
                                  ) : null}
                                </td>
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
                        Solo puede registrar o corregir la asistencia del día actual.
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Use Día para tomar o corregir asistencia. Las vistas Semana y Mes son solo para revisar el
                        historial.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </Panel>
          {docente && selectedTeacherGroupId ? (
            <Panel
              title="Marcar día sin clases para este grupo"
              description="Ese día no se tomará asistencia a este grupo. Si el día sin clases es para toda la escuela, solicítelo a secretaría."
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
        <Panel title="¿Necesita un informe?">
          <p className="text-sm text-slate-600">
            Encuentre los reportes por grupo y las descargas en Excel dentro de
            {' '}<strong>Administración e informes</strong>.
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
        Esta sección es para el personal del plantel. Si necesita un informe, solicítelo en secretaría.
      </p>
    );
  }

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Administración e informes</h1>
        <p className="mt-1 text-sm text-slate-600">
          Indicadores del día y reportes para llevar el control del plantel.
        </p>
      </div>
      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>
      )}
      {admin && (
        <>
          <Panel title="Resumen del día">
            <ValueView data={summary} />
          </Panel>
          <Panel title="Actividad reciente del sistema">
            <ValueView data={audit} />
          </Panel>
          <Panel title="Días sin clases del calendario escolar">
            <ValueView data={calendar} />
          </Panel>
          <Panel title="Pagos pendientes">
            <ValueView data={repAtt} />
          </Panel>
        </>
      )}
      {administrativo && !admin ? (
        <Panel title="Días sin clases de su escuela">
          <NonInstructionalDaysList data={calendar} />
          <p className="mt-3 text-sm text-slate-600">
            Para marcar o quitar días sin clases abra <strong>Horarios</strong> en el menú.
          </p>
        </Panel>
      ) : null}
      <Panel title="Recogidas del día (informe)">
        <ValueView data={circuit} />
      </Panel>
    </div>
  );
}

type TeacherSelfSlot = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  room: string | null;
  subjectId: string | null;
  subjectName: string | null;
  groupId: string | null;
  groupName: string | null;
};

function teacherTodayWeekRange(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  return start.toISOString().slice(0, 10);
}

export function HerramientasPage() {
  const [privacy, setPrivacy] = useState<unknown>(null);
  const [policy, setPolicy] = useState<unknown>(null);
  const [policyHint, setPolicyHint] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<unknown>(null);
  const [schedule, setSchedule] = useState<TeacherSelfSlot[] | null>(null);
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
          const s = await api.get<TeacherSelfSlot[]>('/api/v1/schedules/me/teacher');
          if (!cancelled) setSchedule(Array.isArray(s.data) ? s.data : []);
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
          Política de privacidad, horarios y vehículos para la recogida. Para importar o exportar archivos abra el
          apartado correspondiente en el menú.
        </p>
      </div>
      <Panel title="Política de privacidad" description="Texto vigente sobre cómo se usan y protegen sus datos.">
        {errPolicy && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{errPolicy}</div>
        )}
        {policyHint && <p className="mb-4 text-sm text-slate-600">{policyHint}</p>}
        <ValueView data={policy} />
      </Panel>
      <Panel title="Mis aceptaciones de la política">
        {errAcceptances && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {errAcceptances}
          </div>
        )}
        <ValueView data={privacy} />
      </Panel>
      {padre && (
        <Panel title="Mis vehículos" description="Vehículos autorizados para recoger a su hijo o hija.">
          {errVehicles && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{errVehicles}</div>
          )}
          <VehiclesList data={vehicles} />
        </Panel>
      )}
      {docente && (
        <Panel title="Mi horario semanal" description="Las clases que tiene asignadas a lo largo de la semana.">
          {errSchedule && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{errSchedule}</div>
          )}
          {scheduleHint && <p className="mb-4 text-sm text-amber-800">{scheduleHint}</p>}
          <WeekScheduleGrid
            events={(schedule ?? []).map<WeekScheduleEvent>((s) => ({
              id: s.id,
              weekday: s.weekday,
              startTime: s.startTime,
              endTime: s.endTime,
              title: s.subjectName ?? 'Clase',
              subtitle: s.groupName,
              room: s.room,
              colorKey: s.subjectName ?? s.subjectId ?? s.id
            }))}
            days={buildWeekDays(teacherTodayWeekRange())}
            emptyLabel="Aún no tiene franjas horarias asignadas."
          />
        </Panel>
      )}
      <Panel title="Acceso al plantel">
        <p className="text-sm leading-relaxed text-slate-600">
          Su código QR personal para entrar al plantel está en <strong>Mi perfil</strong>. El personal del plantel
          puede registrar el ingreso desde <strong>Escáner de acceso</strong>.
        </p>
      </Panel>
    </div>
  );
}
