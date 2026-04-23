import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { DetailModal } from '@/components/DetailModal';
import { type SmartSelectOption, SmartSelect } from '@/components/SmartSelect';
import { useAuth } from '@/context/useAuth';
import { hasRole, isStaff } from '@/lib/roles';

type Modality = 'PRESENCIAL' | 'VIRTUAL';
type MeetingStatus = 'PROGRAMADA' | 'REPROGRAMADA' | 'EN_CURSO' | 'REALIZADA' | 'CANCELADA';
type Rsvp = 'PENDIENTE' | 'ACEPTADA' | 'DECLINADA';

type Participant = {
  id: string;
  meetingId: string;
  userId: string;
  participantRole: string;
  studentContextId: string | null;
  rsvp: Rsvp;
  respondedAt: string | null;
  fullName: string;
  email: string;
  role: string;
};

type Meeting = {
  id: string;
  schoolId: string;
  organizerUserId: string;
  organizerRole: string;
  title: string;
  purpose: string;
  modality: Modality;
  location: string | null;
  meetingLink: string | null;
  startAt: string;
  durationMinutes: number;
  status: MeetingStatus;
  cancellationReason: string | null;
  previousStartAt: string | null;
  participants: Participant[];
  counts: { pending: number; accepted: number; declined: number };
};

type GroupRow = { id: string; name: string; grade: string | null; schoolYear: string };
type DirectoryRow = { userId: string; fullName: string; email: string };
type SchoolOption = { id: string; name: string };
const STORAGE_MEETINGS_SCHOOL = 'ep:meetings:schoolId';

function formatDateLong(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function toLocalInputValue(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

function nowLocalInputValue(): string {
  return toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000).toISOString());
}

function statusBadgeClass(status: MeetingStatus): string {
  switch (status) {
    case 'PROGRAMADA':
      return 'bg-sky-100 text-sky-900 border-sky-200';
    case 'REPROGRAMADA':
      return 'bg-amber-100 text-amber-900 border-amber-200';
    case 'EN_CURSO':
      return 'bg-indigo-100 text-indigo-900 border-indigo-200';
    case 'REALIZADA':
      return 'bg-emerald-100 text-emerald-900 border-emerald-200';
    case 'CANCELADA':
      return 'bg-rose-100 text-rose-900 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-200';
  }
}

function rsvpBadgeClass(rsvp: Rsvp): string {
  switch (rsvp) {
    case 'ACEPTADA':
      return 'bg-emerald-100 text-emerald-900 border-emerald-200';
    case 'DECLINADA':
      return 'bg-rose-100 text-rose-900 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-200';
  }
}

export function ReunionesPage() {
  const { user } = useAuth();
  const staff = hasRole(user, 'ADMIN', 'ADMINISTRATIVO', 'DOCENTE');
  const canCreate = isStaff(user);
  const platformAdmin = user?.role === 'ADMIN';
  /** Padres y alumnos no crean reuniones; no mostrar pestaña de organizadas. */
  const showOrganizedTab = staff;

  const [tab, setTab] = useState<'mine' | 'organized' | 'past'>('mine');
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [mine, setMine] = useState<Meeting[]>([]);
  const [organized, setOrganized] = useState<Meeting[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Meeting | null>(null);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem(STORAGE_MEETINGS_SCHOOL) ?? '';
  });

  useEffect(() => {
    if (!platformAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<SchoolOption[]>('/api/v1/schools');
        const rows = Array.isArray(data) ? data : [];
        if (!cancelled) {
          setSchools(rows);
          if (rows.length > 0) {
            setSelectedSchoolId((prev) =>
              prev && rows.some((s) => s.id === prev) ? prev : rows[0].id
            );
          }
        }
      } catch {
        if (!cancelled) setSchools([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [platformAdmin]);

  useEffect(() => {
    if (!platformAdmin || typeof window === 'undefined') return;
    if (!selectedSchoolId) return;
    sessionStorage.setItem(STORAGE_MEETINGS_SCHOOL, selectedSchoolId);
  }, [platformAdmin, selectedSchoolId]);

  const loadLists = useCallback(async () => {
    setErr(null);
    try {
      const mineRes = await api.get<Meeting[]>('/api/v1/meetings/me');
      setMine(Array.isArray(mineRes.data) ? mineRes.data : []);
      if (staff) {
        const params: Record<string, string> = {};
        if (platformAdmin && selectedSchoolId) params.schoolId = selectedSchoolId;
        const orgRes = await api.get<Meeting[]>('/api/v1/meetings', { params });
        setOrganized(Array.isArray(orgRes.data) ? orgRes.data : []);
      } else {
        setOrganized([]);
      }
    } catch (e) {
      setErr(getUserFacingMessage(e));
    }
  }, [staff, platformAdmin, selectedSchoolId]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  useEffect(() => {
    if (!showOrganizedTab && tab === 'organized') {
      setTab('mine');
    }
  }, [showOrganizedTab, tab]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setDetailErr(null);
      try {
        const res = await api.get<Meeting>(`/api/v1/meetings/${selectedId}`);
        if (!cancelled) setDetail(res.data);
      } catch (e) {
        if (!cancelled) setDetailErr(getUserFacingMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const { invitations, organizedByMe, past } = useMemo(() => {
    const now = Date.now();
    const inv: Meeting[] = [];
    const org: Meeting[] = [];
    const pa: Meeting[] = [];
    for (const m of mine) {
      const t = new Date(m.startAt).getTime();
      const finished = m.status === 'CANCELADA' || m.status === 'REALIZADA' || t < now - 2 * 60 * 60 * 1000;
      if (finished) {
        pa.push(m);
      } else if (m.organizerUserId === user?.id) {
        org.push(m);
      } else {
        inv.push(m);
      }
    }
    inv.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    org.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    pa.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
    return { invitations: inv, organizedByMe: org, past: pa };
  }, [mine, user?.id]);

  const list =
    tab === 'mine'
      ? showOrganizedTab
        ? invitations.concat(organizedByMe)
        : invitations
      : tab === 'organized'
        ? organized
        : past;
  const allMeetings = useMemo(() => {
    const byId = new Map<string, Meeting>();
    [...mine, ...organized].forEach((m) => byId.set(m.id, m));
    return Array.from(byId.values());
  }, [mine, organized]);
  const selectedMeeting = selectedId
    ? allMeetings.find((m) => m.id === selectedId) ?? null
    : null;
  const currentDetail = selectedMeeting
    ? detail && detail.id === selectedMeeting.id
      ? detail
      : selectedMeeting
    : null;
  const currentMyPart = currentDetail?.participants.find((p) => p.userId === user?.id);
  const currentIsOrganizer = !!currentDetail && (currentDetail.organizerUserId === user?.id || user?.role === 'ADMIN');

  const reloadAll = async () => {
    await loadLists();
    if (selectedId) {
      try {
        const res = await api.get<Meeting>(`/api/v1/meetings/${selectedId}`);
        setDetail(res.data);
      } catch {
        /* noop */
      }
    }
  };

  const actionCancel = async (id: string) => {
    const reason = window.prompt('Motivo de cancelación (opcional)', '') ?? undefined;
    try {
      await api.post(`/api/v1/meetings/${id}/cancel`, { reason });
      setMsg('Reunión cancelada.');
      await reloadAll();
    } catch (e) {
      setErr(getUserFacingMessage(e));
    }
  };

  const actionReschedule = async (id: string) => {
    const current = mine.find((x) => x.id === id) ?? organized.find((x) => x.id === id);
    const hint = current ? toLocalInputValue(current.startAt) : '';
    const next = window.prompt('Nueva fecha y hora (YYYY-MM-DDTHH:MM)', hint);
    if (!next) return;
    try {
      await api.post(`/api/v1/meetings/${id}/reschedule`, { startAt: new Date(next).toISOString() });
      setMsg('Reunión reprogramada.');
      await reloadAll();
    } catch (e) {
      setErr(getUserFacingMessage(e));
    }
  };

  const actionStatus = async (id: string, action: 'IN_PROGRESS' | 'REALIZED') => {
    try {
      await api.post(`/api/v1/meetings/${id}/status`, { action });
      setMsg(action === 'REALIZED' ? 'Reunión marcada como realizada.' : 'Reunión en curso.');
      await reloadAll();
    } catch (e) {
      setErr(getUserFacingMessage(e));
    }
  };

  const actionRsvp = async (id: string, rsvp: Rsvp) => {
    try {
      await api.post(`/api/v1/meetings/${id}/rsvp`, { rsvp });
      setMsg('Respuesta registrada.');
      await reloadAll();
    } catch (e) {
      setErr(getUserFacingMessage(e));
    }
  };

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Reuniones</h1>
        <p className="mt-1 text-sm text-slate-600">
          Encuentros con la comunidad de la escuela. Confirme su asistencia y reciba un aviso un día antes y una hora
          antes.
        </p>
      </div>
      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{err}</div>
      )}
      {msg && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {msg}
        </div>
      )}

      {platformAdmin && (
        <div className="rounded border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">Institución</span>
            <select
              className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
            >
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {canCreate && (
        <CreateMeetingPanel
          onCreated={reloadAll}
          role={user?.role ?? ''}
          schoolId={platformAdmin ? selectedSchoolId : undefined}
          requireSchoolSelection={platformAdmin}
        />
      )}

      <div className="rounded border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap gap-2 border-b border-slate-200 px-4 pt-3">
          <TabButton active={tab === 'mine'} onClick={() => setTab('mine')}>
            Próximas (
            {showOrganizedTab ? invitations.length + organizedByMe.length : invitations.length})
          </TabButton>
          {showOrganizedTab ? (
            <TabButton active={tab === 'organized'} onClick={() => setTab('organized')}>
              Organizadas ({organized.length})
            </TabButton>
          ) : null}
          <TabButton active={tab === 'past'} onClick={() => setTab('past')}>
            Pasadas ({past.length})
          </TabButton>
        </div>
        <div className="p-4">
          {list.length === 0 ? (
            <p className="text-sm text-slate-600">No hay reuniones en esta vista.</p>
          ) : (
            <ul className="space-y-3">
              {list.map((m) => {
                const myPart = m.participants.find((p) => p.userId === user?.id);
                const isOrganizer = m.organizerUserId === user?.id;
                return (
                  <li
                    key={m.id}
                    className="rounded border border-slate-200 bg-slate-50 p-3 transition hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-900"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(m.id)}
                      className="flex w-full flex-col gap-1 text-left"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900">{m.title}</span>
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(m.status)}`}
                          >
                            {m.status}
                          </span>
                          {myPart && !isOrganizer && (
                            <span
                              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${rsvpBadgeClass(myPart.rsvp)}`}
                            >
                              {myPart.rsvp}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-slate-700">{formatDateLong(m.startAt)}</span>
                      <span className="text-xs text-slate-500">
                        Modalidad: {m.modality}
                        {m.modality === 'PRESENCIAL' && m.location ? ` · ${m.location}` : ''}
                        {' · '}
                        {m.participants.length} participantes · {m.counts.accepted} aceptadas ·{' '}
                        {m.counts.declined} declinadas
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      <DetailModal
        open={!!currentDetail}
        title={currentDetail?.title ?? 'Detalle de reunión'}
        subtitle={currentDetail ? formatDateLong(currentDetail.startAt) : ''}
        badge={
          currentDetail ? (
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(currentDetail.status)}`}>
              {currentDetail.status}
            </span>
          ) : null
        }
        onClose={() => setSelectedId(null)}
        footer={
          currentDetail ? (
            <MeetingActions
              detail={currentDetail}
              isOrganizer={currentIsOrganizer}
              isParticipant={Boolean(currentMyPart)}
              onCancel={() => actionCancel(currentDetail.id)}
              onReschedule={() => actionReschedule(currentDetail.id)}
              onInProgress={() => actionStatus(currentDetail.id, 'IN_PROGRESS')}
              onRealized={() => actionStatus(currentDetail.id, 'REALIZED')}
              onRsvp={(r) => actionRsvp(currentDetail.id, r)}
            />
          ) : null
        }
      >
        {currentDetail ? <MeetingDetailView detail={currentDetail} detailErr={detailErr} /> : null}
      </DetailModal>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-t border-b-2 px-3 py-2 text-sm font-medium ${
        active
          ? 'border-brand-800 text-brand-900 dark:border-brand-300 dark:text-brand-200'
          : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
      }`}
    >
      {children}
    </button>
  );
}

function MeetingDetailView({
  detail,
  detailErr
}: {
  detail: Meeting;
  detailErr: string | null;
}) {
  const participantsForDisplay =
    detail.status === 'REALIZADA'
      ? detail.participants.filter((p) => p.rsvp === 'ACEPTADA')
      : detail.participants;
  return (
    <div className="space-y-3 text-sm">
      {detailErr && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-900">{detailErr}</div>
      )}
      <p className="text-slate-700">
        <span className="font-medium text-slate-900">Propósito:</span> {detail.purpose}
      </p>
      <div className="grid grid-cols-1 gap-3 rounded border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-2 dark:border-slate-700 dark:bg-slate-800">
        <p className="text-slate-700">
          <span className="font-medium text-slate-900">Fecha y hora:</span> {formatDateLong(detail.startAt)}
        </p>
        <p className="text-slate-700">
          <span className="font-medium text-slate-900">Duración:</span> {detail.durationMinutes} min
        </p>
        <p className="text-slate-700">
          <span className="font-medium text-slate-900">Modalidad:</span> {detail.modality}
        </p>
        <p className="text-slate-700">
          <span className="font-medium text-slate-900">Organiza:</span> {detail.organizerRole}
        </p>
        {detail.modality === 'PRESENCIAL' ? (
          <p className="text-slate-700 sm:col-span-2">
            <span className="font-medium text-slate-900">Lugar:</span> {detail.location ?? 'No especificado'}
          </p>
        ) : null}
        {detail.previousStartAt ? (
          <p className="text-slate-700 sm:col-span-2">
            <span className="font-medium text-slate-900">Fecha anterior:</span> {formatDateLong(detail.previousStartAt)}
          </p>
        ) : null}
      </div>
      {detail.modality === 'VIRTUAL' && detail.meetingLink && (
        <p className="text-slate-700">
          <span className="font-medium text-slate-900">Enlace:</span>{' '}
          <a href={detail.meetingLink} target="_blank" rel="noopener" className="text-brand-700 underline">
            {detail.meetingLink}
          </a>
        </p>
      )}
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-3">
          <span className="font-medium text-slate-900">
            Participantes ({participantsForDisplay.length})
          </span>
          {detail.status !== 'REALIZADA' ? (
            <span className="text-xs text-slate-600">
              Aceptadas: {detail.counts.accepted} · Pendientes: {detail.counts.pending} · Declinadas: {detail.counts.declined}
            </span>
          ) : (
            <span className="text-xs text-slate-600">Solo se muestran asistentes confirmados (ACEPTADA).</span>
          )}
        </div>
        <ul className="mt-1 divide-y divide-slate-100 rounded border border-slate-200 bg-slate-50 dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
          {participantsForDisplay.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-3 py-2">
              <span className="text-slate-800">
                {p.fullName} <span className="text-xs text-slate-500">· {p.role}</span>
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${rsvpBadgeClass(p.rsvp)}`}
              >
                {p.rsvp}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {detail.cancellationReason && (
        <p className="text-slate-700">
          <span className="font-medium text-slate-900">Motivo de cancelación:</span>{' '}
          {detail.cancellationReason}
        </p>
      )}
    </div>
  );
}

function MeetingActions({
  detail,
  isOrganizer,
  isParticipant,
  onCancel,
  onReschedule,
  onInProgress,
  onRealized,
  onRsvp
}: {
  detail: Meeting;
  isOrganizer: boolean;
  isParticipant: boolean;
  onCancel: () => void;
  onReschedule: () => void;
  onInProgress: () => void;
  onRealized: () => void;
  onRsvp: (rsvp: Rsvp) => void;
}) {
  const canAct = detail.status !== 'CANCELADA' && detail.status !== 'REALIZADA';
  if (!canAct) return null;
  return (
    <>
      {isParticipant && !isOrganizer ? (
        <>
          <button type="button" onClick={() => onRsvp('ACEPTADA')} className="rounded border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100">Confirmar asistencia</button>
          <button type="button" onClick={() => onRsvp('DECLINADA')} className="rounded border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-900 hover:bg-rose-100">Declinar</button>
          <button type="button" onClick={() => onRsvp('PENDIENTE')} className="rounded border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100">Dejar pendiente</button>
        </>
      ) : null}
      {isOrganizer ? (
        <>
          {detail.status !== 'EN_CURSO' ? (
            <button type="button" onClick={onInProgress} className="rounded border border-indigo-300 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-900 hover:bg-indigo-100">Iniciar (en curso)</button>
          ) : null}
          <button type="button" onClick={onReschedule} className="rounded border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100">Reprogramar</button>
          <button type="button" onClick={onRealized} className="rounded border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100">Marcar realizada</button>
          <button type="button" onClick={onCancel} className="rounded border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-900 hover:bg-rose-100">Cancelar reunión</button>
        </>
      ) : null}
    </>
  );
}

type InviteItem = { userId: string; label: string; studentContextId?: string };

function CreateMeetingPanel({
  onCreated,
  role,
  schoolId,
  requireSchoolSelection
}: {
  onCreated: () => Promise<void> | void;
  role: string;
  schoolId?: string;
  requireSchoolSelection?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [modality, setModality] = useState<Modality>('PRESENCIAL');
  const [location, setLocation] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [startAt, setStartAt] = useState(nowLocalInputValue());
  const [duration, setDuration] = useState('30');
  const [invitees, setInvitees] = useState<InviteItem[]>([]);
  const [presetParents, setPresetParents] = useState<string[]>([]);
  const [presetAllTeachers, setPresetAllTeachers] = useState(false);
  const [presetAllAdmins, setPresetAllAdmins] = useState(false);
  const [userPick, setUserPick] = useState('');
  const [groupPick, setGroupPick] = useState('');

  const docenteOnly = role === 'DOCENTE';

  const loadGroups = useCallback(async (q: string, signal: AbortSignal) => {
    const endpoint = docenteOnly
      ? '/api/v1/schedules/me/teacher/groups'
      : '/api/v1/school/groups';
    const params: Record<string, string | number | undefined> = { q: q.trim() || undefined, limit: 80 };
    if (!docenteOnly && schoolId) params.schoolId = schoolId;
    const { data } = await api.get<GroupRow[]>(endpoint, {
      params,
      signal
    });
    const rows = Array.isArray(data) ? data : [];
    return rows.map(
      (g): SmartSelectOption => ({
        value: g.id,
        label: `${g.name}${g.grade ? ` · ${g.grade}` : ''} · ${g.schoolYear}`
      })
    );
  }, [docenteOnly, schoolId]);

  const loadUsers = useCallback(async (q: string, signal: AbortSignal) => {
    const params: Record<string, string | number | undefined> = { q: q.trim() || undefined, limit: 50 };
    if (schoolId) params.schoolId = schoolId;
    const out: SmartSelectOption[] = [];
    const teachers = await api.get<DirectoryRow[]>('/api/v1/school/teachers', { params, signal });
    (Array.isArray(teachers.data) ? teachers.data : []).forEach((x) =>
      out.push({ value: x.userId, label: `${x.fullName} — Docente (${x.email})` })
    );
    const parents = await api.get<DirectoryRow[]>('/api/v1/school/parents', { params, signal });
    (Array.isArray(parents.data) ? parents.data : []).forEach((x) =>
      out.push({ value: x.userId, label: `${x.fullName} — Padre/madre (${x.email})` })
    );
    const students = await api.get<
      { userId: string; fullName: string; email: string; matricula: string }[]
    >('/api/v1/school/students', { params, signal });
    (Array.isArray(students.data) ? students.data : []).forEach((x) =>
      out.push({
        value: x.userId,
        label: `${x.fullName} — Alumno (${x.email})`,
        searchText: x.matricula
      })
    );
    out.sort((a, b) => a.label.localeCompare(b.label, 'es'));
    return out;
  }, [docenteOnly, schoolId]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (requireSchoolSelection && !schoolId) {
      setErr('Seleccione primero la institución para crear la reunión.');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        purpose: purpose.trim(),
        modality,
        location: location.trim() || undefined,
        meetingLink: meetingLink.trim() || undefined,
        startAt: new Date(startAt).toISOString(),
        durationMinutes: Number(duration) || 30,
        invitees: invitees.map((i) => ({
          userId: i.userId,
          ...(i.studentContextId ? { studentContextId: i.studentContextId } : {})
        })),
        presetAllParentsOfGroupIds: presetParents
      };
      if (!docenteOnly) {
        payload.presetAllTeachersOfSchool = presetAllTeachers;
        payload.presetAllAdministrativesOfSchool = presetAllAdmins;
      }
      const params: Record<string, string> = {};
      if (schoolId) params.schoolId = schoolId;
      await api.post('/api/v1/meetings', payload, { params });
      setTitle('');
      setPurpose('');
      setLocation('');
      setMeetingLink('');
      setStartAt(nowLocalInputValue());
      setDuration('30');
      setInvitees([]);
      setPresetParents([]);
      setPresetAllTeachers(false);
      setPresetAllAdmins(false);
      setOpen(false);
      await onCreated();
    } catch (e2) {
      setErr(getUserFacingMessage(e2, 'No se pudo crear la reunión.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-semibold text-slate-900">
          {open ? 'Cerrar formulario' : 'Crear nueva reunión'}
        </span>
        <span className="text-xs text-slate-600">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <form onSubmit={onSubmit} className="grid gap-3 border-t border-slate-200 p-4 sm:grid-cols-2">
          {err && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 sm:col-span-2">
              {err}
            </div>
          )}
          <label className="text-sm sm:col-span-2">
            <span className="text-slate-700">Título</span>
            <input
              required
              maxLength={150}
              minLength={3}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-slate-700">Motivo / objetivo</span>
            <textarea
              required
              rows={3}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Modalidad</span>
            <select
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={modality}
              onChange={(e) => setModality(e.target.value as Modality)}
            >
              <option value="PRESENCIAL">Presencial</option>
              <option value="VIRTUAL">Virtual</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Duración (minutos)</span>
            <input
              type="number"
              min={5}
              max={600}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </label>
          {modality === 'PRESENCIAL' ? (
            <label className="text-sm sm:col-span-2">
              <span className="text-slate-700">Lugar</span>
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Sala de juntas, Aula 101…"
              />
            </label>
          ) : (
            <label className="text-sm sm:col-span-2">
              <span className="text-slate-700">Enlace de la reunión</span>
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                placeholder="https://…"
              />
            </label>
          )}
          <label className="text-sm sm:col-span-2">
            <span className="text-slate-700">Fecha y hora</span>
            <input
              type="datetime-local"
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </label>

          <fieldset className="text-sm sm:col-span-2">
            <legend className="text-slate-700">Invitados — presets</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {!docenteOnly && (
                <>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={presetAllTeachers}
                      onChange={(e) => setPresetAllTeachers(e.target.checked)}
                    />
                    <span>Todos los docentes de la escuela</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={presetAllAdmins}
                      onChange={(e) => setPresetAllAdmins(e.target.checked)}
                    />
                    <span>Todo el equipo administrativo</span>
                  </label>
                </>
              )}
            </div>
            <div className="mt-2">
              <span className="text-slate-700">Padres de grupos específicos</span>
              <div className="mt-1">
                <SmartSelect
                  loadOptions={loadGroups}
                  value={groupPick}
                  onChange={(v) => {
                    if (v && !presetParents.includes(v)) setPresetParents([...presetParents, v]);
                    setGroupPick('');
                  }}
                  placeholder="— Buscar grupo —"
                />
              </div>
              <ul className="mt-2 flex flex-wrap gap-2">
                {presetParents.map((id) => (
                  <li
                    key={id}
                    className="flex items-center gap-2 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs"
                  >
                    {id.slice(0, 8)}…
                    <button
                      type="button"
                      onClick={() => setPresetParents(presetParents.filter((x) => x !== id))}
                      className="text-slate-500 hover:text-slate-800"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </fieldset>

          <div className="text-sm sm:col-span-2">
            <span className="text-slate-700">Invitados específicos</span>
            <div className="mt-1">
              <SmartSelect
                loadOptions={loadUsers}
                value={userPick}
                onChange={(v) => {
                  if (v && !invitees.some((x) => x.userId === v))
                    setInvitees([...invitees, { userId: v, label: v.slice(0, 8) }]);
                  setUserPick('');
                }}
                placeholder="— Buscar usuario —"
              />
            </div>
            <ul className="mt-2 flex flex-wrap gap-2">
              {invitees.map((i) => (
                <li
                  key={i.userId}
                  className="flex items-center gap-2 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs"
                >
                  {i.label}
                  <button
                    type="button"
                    onClick={() => setInvitees(invitees.filter((x) => x.userId !== i.userId))}
                    className="text-slate-500 hover:text-slate-800"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving || (requireSchoolSelection && !schoolId)}
              className="rounded bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
            >
              {saving ? 'Creando…' : 'Crear reunión'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
