import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { DetailModal } from '@/components/DetailModal';
import { SCROLLABLE_PANEL_BODY, DATA_TABLE_SEARCH_INPUT } from '@/components/DataTableScroll';
import { type SmartSelectOption, SmartSelect } from '@/components/SmartSelect';
import { useAuth } from '@/context/useAuth';
import { hasRole, isStaff } from '@/lib/roles';

type Modality = 'PRESENCIAL' | 'VIRTUAL';
type MeetingStatus = 'PROGRAMADA' | 'REPROGRAMADA' | 'EN_CURSO' | 'REALIZADA' | 'CANCELADA';
type Rsvp = 'PENDIENTE' | 'ACEPTADA' | 'DECLINADA' | 'NO_ASISTIO';
type RsvpEditable = 'PENDIENTE' | 'ACEPTADA' | 'DECLINADA';

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
  counts: { pending: number; accepted: number; declined: number; noShow: number };
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

/** Suma milisegundos a un valor `datetime-local` interpretado en hora local. */
function bumpDatetimeLocal(value: string, addMs: number): string {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;
  const next = new Date(d.getTime() + addMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(next.getHours())}:${pad(next.getMinutes())}`;
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
    case 'NO_ASISTIO':
      return 'bg-amber-100 text-amber-900 border-amber-200';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-200';
  }
}

function rsvpLabel(rsvp: Rsvp): string {
  if (rsvp === 'NO_ASISTIO') return 'NO ASISTIÓ';
  return rsvp;
}

function rsvpHint(rsvp: Rsvp): string | undefined {
  if (rsvp === 'NO_ASISTIO') return 'No respondió antes de finalizar la reunión.';
  if (rsvp === 'DECLINADA') return 'Marcó que no asistiría.';
  return undefined;
}

export function ReunionesPage() {
  const { user } = useAuth();
  const staff = hasRole(user, 'ADMIN', 'ADMINISTRATIVO', 'DOCENTE');
  const canCreate = isStaff(user);
  const platformAdmin = user?.role === 'ADMIN';
  /** Padres y alumnos no crean reuniones; no mostrar pestaña de organizadas. */
  const showOrganizedTab = staff;

  const [tab, setTab] = useState<'mine' | 'organized' | 'past'>('mine');
  const [listSearch, setListSearch] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [mine, setMine] = useState<Meeting[]>([]);
  const [organized, setOrganized] = useState<Meeting[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Meeting | null>(null);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<{
    id: string;
    title: string;
    currentStartAt: string;
  } | null>(null);
  const [rescheduleStartAt, setRescheduleStartAt] = useState('');
  const [rescheduleSaving, setRescheduleSaving] = useState(false);
  const [rescheduleErr, setRescheduleErr] = useState<string | null>(null);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem(STORAGE_MEETINGS_SCHOOL) ?? '';
  });
  const selectedSchoolName = useMemo(
    () => schools.find((s) => s.id === selectedSchoolId)?.name ?? '',
    [schools, selectedSchoolId]
  );

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
    setListSearch('');
  }, [tab]);

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

  const filteredMeetingList = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) => {
      const blob = [
        m.title,
        m.purpose,
        m.modality,
        m.location,
        m.meetingLink,
        m.status,
        formatDateLong(m.startAt),
        String(m.participants.length),
        m.organizerRole
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [list, listSearch]);

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

  const closeRescheduleModal = () => {
    if (rescheduleSaving) return;
    setRescheduleOpen(false);
    setRescheduleTarget(null);
    setRescheduleErr(null);
  };

  const openReschedule = (id: string) => {
    const m = mine.find((x) => x.id === id) ?? organized.find((x) => x.id === id);
    if (!m) return;
    setRescheduleTarget({ id: m.id, title: m.title, currentStartAt: m.startAt });
    setRescheduleStartAt(toLocalInputValue(m.startAt));
    setRescheduleErr(null);
    setRescheduleOpen(true);
  };

  const confirmReschedule = async () => {
    if (!rescheduleTarget) return;
    const d = new Date(rescheduleStartAt);
    if (!Number.isFinite(d.getTime())) {
      setRescheduleErr('Indique una fecha y hora válidas.');
      return;
    }
    setRescheduleSaving(true);
    setRescheduleErr(null);
    try {
      await api.post(`/api/v1/meetings/${rescheduleTarget.id}/reschedule`, { startAt: d.toISOString() });
      setMsg('Reunión reprogramada.');
      setRescheduleOpen(false);
      setRescheduleTarget(null);
      setRescheduleErr(null);
      await reloadAll();
    } catch (e) {
      setRescheduleErr(getUserFacingMessage(e));
    } finally {
      setRescheduleSaving(false);
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

  const actionStatus = async (id: string, action: 'IN_PROGRESS' | 'REALIZED') => {
    try {
      await api.post(`/api/v1/meetings/${id}/status`, { action });
      setMsg(action === 'REALIZED' ? 'Reunión marcada como realizada.' : 'Reunión en curso.');
      await reloadAll();
    } catch (e) {
      setErr(getUserFacingMessage(e));
    }
  };

  const actionRsvp = async (id: string, rsvp: RsvpEditable) => {
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
          targetSchoolName={platformAdmin ? selectedSchoolName : undefined}
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
            <p className="text-sm text-slate-600 dark:text-slate-300">No hay reuniones en esta vista.</p>
          ) : (
            <>
              <label className="mb-3 block max-w-md text-sm text-slate-700 dark:text-slate-200">
                <span className="font-medium">Buscar en esta vista</span>
                <input
                  type="search"
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  placeholder="Título, modalidad, lugar, estado…"
                  className={`mt-1 ${DATA_TABLE_SEARCH_INPUT}`}
                />
              </label>
              {filteredMeetingList.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-300">Ninguna reunión coincide con la búsqueda.</p>
              ) : (
                <div className={`${SCROLLABLE_PANEL_BODY} pr-1`}>
                  <ul className="space-y-3">
                    {filteredMeetingList.map((m) => {
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
                              <span className="font-semibold text-slate-900 dark:text-slate-100">{m.title}</span>
                              <div className="flex flex-wrap gap-2">
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(m.status)}`}
                                >
                                  {m.status}
                                </span>
                                {myPart && !isOrganizer && (
                                  <span
                                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${rsvpBadgeClass(myPart.rsvp)}`}
                                    title={rsvpHint(myPart.rsvp)}
                                  >
                                    {rsvpLabel(myPart.rsvp)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-sm text-slate-700 dark:text-slate-300">{formatDateLong(m.startAt)}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              Modalidad: {m.modality}
                              {m.modality === 'PRESENCIAL' && m.location ? ` · ${m.location}` : ''}
                              {' · '}
                              {m.participants.length} participantes · {m.counts.accepted} aceptadas ·{' '}
                              {m.counts.declined} declinadas · {m.counts.noShow} no asistieron
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
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
              onReschedule={() => openReschedule(currentDetail.id)}
              onInProgress={() => actionStatus(currentDetail.id, 'IN_PROGRESS')}
              onRealized={() => actionStatus(currentDetail.id, 'REALIZED')}
              onRsvp={(r) => actionRsvp(currentDetail.id, r)}
            />
          ) : null
        }
      >
        {currentDetail ? <MeetingDetailView detail={currentDetail} detailErr={detailErr} /> : null}
      </DetailModal>

      <DetailModal
        open={rescheduleOpen && !!rescheduleTarget}
        overlayZClass="z-[100]"
        title="Reprogramar reunión"
        subtitle={rescheduleTarget?.title ?? null}
        onClose={closeRescheduleModal}
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={rescheduleSaving}
              onClick={closeRescheduleModal}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={rescheduleSaving}
              onClick={() => void confirmReschedule()}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
            >
              {rescheduleSaving ? 'Guardando…' : 'Confirmar nueva fecha'}
            </button>
          </div>
        }
      >
        {rescheduleTarget ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-600 dark:bg-slate-800/80">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Horario actual
              </p>
              <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                {formatDateLong(rescheduleTarget.currentStartAt)}
              </p>
            </div>
            {rescheduleErr ? (
              <div
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-100"
                role="alert"
              >
                {rescheduleErr}
              </div>
            ) : null}
            <label className="block text-sm">
              <span className="font-medium text-slate-800 dark:text-slate-200">Nueva fecha y hora</span>
              <input
                type="datetime-local"
                value={rescheduleStartAt}
                onChange={(e) => setRescheduleStartAt(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none ring-brand-500/20 focus:border-brand-500 focus:ring-4 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-brand-400"
              />
            </label>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Ajuste rápido</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    { label: '+30 min', ms: 30 * 60 * 1000 },
                    { label: '+1 h', ms: 60 * 60 * 1000 },
                    { label: '+1 día', ms: 24 * 60 * 60 * 1000 }
                  ] as const
                ).map(({ label, ms }) => (
                  <button
                    key={label}
                    type="button"
                    disabled={rescheduleSaving}
                    onClick={() => setRescheduleStartAt((prev) => bumpDatetimeLocal(prev, ms))}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/50 dark:hover:bg-brand-950/50"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Los invitados volverán a estado pendiente de confirmación (salvo quienes ya habían declinado). Se enviarán
              avisos según la configuración de recordatorios de la institución.
            </p>
          </div>
        ) : null}
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
              Aceptadas: {detail.counts.accepted} · Pendientes: {detail.counts.pending} · Declinadas: {detail.counts.declined} · No asistieron: {detail.counts.noShow}
            </span>
          ) : (
            <span className="text-xs text-slate-600">Solo se muestran asistentes confirmados (ACEPTADA).</span>
          )}
        </div>
        <div className="mt-1 overflow-hidden rounded border border-slate-200 dark:border-slate-700">
          <ul className={`divide-y divide-slate-100 bg-slate-50 dark:divide-slate-700 dark:bg-slate-800 ${SCROLLABLE_PANEL_BODY}`}>
            {participantsForDisplay.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-3 py-2">
                <span className="text-slate-800 dark:text-slate-100">
                  {p.fullName} <span className="text-xs text-slate-500">· {p.role}</span>
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-medium ${rsvpBadgeClass(p.rsvp)}`}
                  title={rsvpHint(p.rsvp)}
                >
                  {rsvpLabel(p.rsvp)}
                </span>
              </li>
            ))}
          </ul>
        </div>
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
  onRsvp: (rsvp: RsvpEditable) => void;
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
type PresetGroupPick = { id: string; label: string };

function CreateMeetingPanel({
  onCreated,
  role,
  schoolId,
  requireSchoolSelection,
  targetSchoolName
}: {
  onCreated: () => Promise<void> | void;
  role: string;
  schoolId?: string;
  requireSchoolSelection?: boolean;
  targetSchoolName?: string;
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
  const [presetParents, setPresetParents] = useState<PresetGroupPick[]>([]);
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
    if (docenteOnly) return [];
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
        invitees: docenteOnly
          ? []
          : invitees.map((i) => ({
              userId: i.userId,
              ...(i.studentContextId ? { studentContextId: i.studentContextId } : {})
            })),
        presetAllParentsOfGroupIds: presetParents.map((p) => p.id)
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
          {requireSchoolSelection && targetSchoolName ? (
            <div className="rounded border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900 sm:col-span-2 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-100">
              <span className="font-medium">Institución destino:</span>{' '}
              <span className="font-semibold">{targetSchoolName}</span>
            </div>
          ) : null}
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
                  onChange={(v, opt) => {
                    if (v && !presetParents.some((p) => p.id === v)) {
                      setPresetParents([
                        ...presetParents,
                        { id: v, label: opt?.label ?? v }
                      ]);
                    }
                    setGroupPick('');
                  }}
                  placeholder="— Buscar grupo —"
                />
              </div>
              <div className={`mt-2 ${SCROLLABLE_PANEL_BODY}`}>
                <ul className="flex flex-wrap gap-2 py-0.5">
                  {presetParents.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-2 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs"
                    >
                      <span className="max-w-[min(100%,18rem)] truncate" title={p.label}>
                        {p.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPresetParents(presetParents.filter((x) => x.id !== p.id))}
                        className="text-slate-500 hover:text-slate-800"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </fieldset>

          {!docenteOnly ? (
            <div className="text-sm sm:col-span-2">
              <span className="text-slate-700">Invitados específicos</span>
              <div className="mt-1">
                <SmartSelect
                  loadOptions={loadUsers}
                  value={userPick}
                  onChange={(v, opt) => {
                    if (v && !invitees.some((x) => x.userId === v))
                      setInvitees([...invitees, { userId: v, label: opt?.label ?? v }]);
                    setUserPick('');
                  }}
                  placeholder="— Buscar usuario —"
                />
              </div>
              <div className={`mt-2 ${SCROLLABLE_PANEL_BODY}`}>
                <ul className="flex flex-wrap gap-2 py-0.5">
                  {invitees.map((i) => (
                    <li
                      key={i.userId}
                      className="flex items-center gap-2 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs"
                    >
                      <span className="max-w-[min(100%,18rem)] truncate" title={i.label}>
                        {i.label}
                      </span>
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
            </div>
          ) : null}

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
