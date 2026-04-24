import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { useAuth } from '@/context/useAuth';
import { DetailModal } from '@/components/DetailModal';
import {
  buildWeekDays,
  WeekScheduleEvent,
  WeekScheduleGrid
} from '@/components/WeekScheduleGrid';

type SlotRow = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  subjectId: string | null;
  room: string | null;
  subjectName: string | null;
};

type SchedulePayload = {
  groupId: string | null;
  group: { id: string; name: string; grade: string | null; schoolYear: string } | null;
  slots: SlotRow[];
};

type TeacherSelfSlot = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  subjectId: string | null;
  subjectName: string | null;
  groupId: string | null;
  groupName: string | null;
  room: string | null;
};

type CalendarDay = {
  id: string;
  exceptionDate: string;
  groupId: string | null;
  reason: string | null;
};

type MeetingRow = {
  id: string;
  title?: string;
  topic?: string;
  purpose?: string;
  modality?: string;
  durationMinutes?: number;
  startAt?: string;
  startsAt?: string;
  scheduledAt?: string;
  start_at?: string;
  status?: string | null;
};

type VisitScheduleRow = {
  id: string;
  title: string;
  visitorName: string;
  visitDatetime: string;
  durationMinutes: number;
  status: string;
  location?: string | null;
};

type NotifRow = {
  id: string;
  title: string;
  message: string;
  sentAt: string;
  readAt: string | null;
};

function weekRangeISO(offsetWeeks: number): { from: string; to: string; label: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff + offsetWeeks * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const label = `${start.toLocaleDateString('es', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })}`;
  return { from: fmt(start), to: fmt(end), label };
}

function localDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseFlexibleInstant(iso: string): Date {
  if (iso.length <= 10) return new Date(`${iso}T12:00:00`);
  return new Date(iso);
}

function meetingWhenIso(m: MeetingRow & Record<string, unknown>): string | null {
  const v = m.startAt ?? m.startsAt ?? m.scheduledAt ?? m.start_at;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function isDateInWeek(dayISO: string, weekFrom: string, weekTo: string): boolean {
  return dayISO >= weekFrom && dayISO <= weekTo;
}

export function StudentSchedulePage() {
  const { user } = useAuth();
  const alumno = user?.role === 'ALUMNO';
  const docente = user?.role === 'DOCENTE';
  const [weekOffset, setWeekOffset] = useState(0);
  const { from, to, label } = useMemo(() => weekRangeISO(weekOffset), [weekOffset]);

  const [schedule, setSchedule] = useState<SchedulePayload | null>(null);
  const [teacherSlots, setTeacherSlots] = useState<TeacherSelfSlot[] | null>(null);
  const [calendar, setCalendar] = useState<{ groupId: string | null; days: CalendarDay[] } | null>(null);
  const [notifications, setNotifications] = useState<NotifRow[] | null>(null);
  const [meetings, setMeetings] = useState<MeetingRow[] | null>(null);
  const [visits, setVisits] = useState<VisitScheduleRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSlotId, setOpenSlotId] = useState<string | null>(null);
  const [openCalendarEventId, setOpenCalendarEventId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!alumno && !docente) return;
    setErr(null);
    setLoading(true);
    try {
      if (alumno) {
        const [sRes, cRes, nRes, mRes, vRes] = await Promise.all([
          api.get<SchedulePayload>(
            `/api/v1/schedules/me/student?refDate=${encodeURIComponent(to)}&weekFrom=${encodeURIComponent(from)}`
          ),
          api.get<{ groupId: string | null; days: CalendarDay[] }>(
            `/api/v1/calendar/me/student?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
          ),
          api.get<{ data: NotifRow[] }>('/api/v1/notifications/me?limit=25'),
          api.get<MeetingRow[]>('/api/v1/meetings/me').catch(() => ({ data: [] as MeetingRow[] })),
          api.get<VisitScheduleRow[]>('/api/v1/external-visits/me').catch(() => ({ data: [] as VisitScheduleRow[] }))
        ]);
        setSchedule(sRes.data);
        setTeacherSlots(null);
        setCalendar(cRes.data);
        setNotifications(nRes.data.data ?? []);
        const meetPayload = mRes.data as unknown;
        const meetList = Array.isArray(meetPayload)
          ? meetPayload
          : meetPayload &&
              typeof meetPayload === 'object' &&
              Array.isArray((meetPayload as { items?: unknown }).items)
            ? ((meetPayload as { items: MeetingRow[] }).items ?? [])
            : [];
        setMeetings(meetList as MeetingRow[]);
        const visitPayload = vRes.data as unknown;
        setVisits(Array.isArray(visitPayload) ? visitPayload : []);
      } else {
        const [sRes, nRes, mRes, vRes] = await Promise.all([
          api.get<TeacherSelfSlot[]>(`/api/v1/schedules/me/teacher?refDate=${encodeURIComponent(to)}`),
          api.get<{ data: NotifRow[] }>('/api/v1/notifications/me?limit=25'),
          api.get<MeetingRow[]>('/api/v1/meetings/me').catch(() => ({ data: [] as MeetingRow[] })),
          api.get<VisitScheduleRow[]>('/api/v1/external-visits/me').catch(() => ({ data: [] as VisitScheduleRow[] }))
        ]);
        const slots = Array.isArray(sRes.data) ? sRes.data : [];
        const groupIds = Array.from(new Set(slots.map((s) => s.groupId).filter((x): x is string => Boolean(x))));
        const dayChunks = await Promise.all(
          groupIds.map(async (gid) => {
            const res = await api
              .get<CalendarDay[]>(
                `/api/v1/calendar/non-instructional-days?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&groupId=${encodeURIComponent(gid)}`
              )
              .catch(() => ({ data: [] as CalendarDay[] }));
            return Array.isArray(res.data) ? res.data : [];
          })
        );
        const dayMap = new Map<string, CalendarDay>();
        for (const chunk of dayChunks) {
          for (const d of chunk) dayMap.set(d.id, d);
        }
        setSchedule(null);
        setTeacherSlots(slots);
        setCalendar({ groupId: null, days: Array.from(dayMap.values()) });
        setNotifications(nRes.data.data ?? []);
        const meetPayload = mRes.data as unknown;
        const meetList = Array.isArray(meetPayload)
          ? meetPayload
          : meetPayload &&
              typeof meetPayload === 'object' &&
              Array.isArray((meetPayload as { items?: unknown }).items)
            ? ((meetPayload as { items: MeetingRow[] }).items ?? [])
            : [];
        setMeetings(meetList as MeetingRow[]);
        const visitPayload = vRes.data as unknown;
        setVisits(Array.isArray(visitPayload) ? visitPayload : []);
      }
    } catch (e) {
      setErr(getUserFacingMessage(e, 'No se pudo cargar el horario.'));
      setSchedule(null);
      setTeacherSlots(null);
      setCalendar(null);
      setNotifications(null);
      setMeetings(null);
      setVisits(null);
    } finally {
      setLoading(false);
    }
  }, [alumno, docente, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const weekCalendarDays = useMemo(() => {
    const days = calendar?.days ?? [];
    return days.filter((d) => {
      const x = d.exceptionDate.slice(0, 10);
      return x >= from && x <= to;
    });
  }, [calendar?.days, from, to]);

  const dayOffByISO = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const d of weekCalendarDays) {
      map.set(d.exceptionDate.slice(0, 10), d.reason ?? null);
    }
    return map;
  }, [weekCalendarDays]);

  const weekDays = useMemo(() => buildWeekDays(from, dayOffByISO), [from, dayOffByISO]);

  const meetingsAndVisitsGridEvents = useMemo<WeekScheduleEvent[]>(() => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const out: WeekScheduleEvent[] = [];

    const pushTimed = (
      whenIso: string,
      durationMinutes: number,
      title: string,
      subtitle: string | null,
      id: string,
      colorKey: string
    ) => {
      const d = parseFlexibleInstant(whenIso);
      if (Number.isNaN(d.getTime())) return;
      const dayStr = localDateISO(d);
      if (!isDateInWeek(dayStr, from, to)) return;
      const startM = d.getHours() * 60 + d.getMinutes();
      const dur = Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 30;
      const endM = Math.min(startM + dur, 24 * 60 - 1);
      const sh = Math.floor(startM / 60);
      const sm = startM % 60;
      const eh = Math.floor(endM / 60);
      const em = endM % 60;
      out.push({
        id,
        weekday: d.getDay(),
        startTime: `${pad(sh)}:${pad(sm)}:00`,
        endTime: `${pad(eh)}:${pad(em)}:00`,
        title,
        subtitle,
        room: null,
        colorKey
      });
    };

    for (const m of meetings ?? []) {
      if (m.status === 'CANCELADA') continue;
      const when = meetingWhenIso(m as MeetingRow & Record<string, unknown>);
      if (!when) continue;
      const dur = m.durationMinutes ?? 30;
      const label = m.title ?? m.topic ?? 'Reunión';
      const sub = m.modality === 'VIRTUAL' ? 'Virtual' : m.modality === 'PRESENCIAL' ? 'Presencial' : null;
      pushTimed(when, dur, `Reunión: ${label}`, sub, `meeting-${m.id}`, `reunion:${m.id}`);
    }
    for (const v of visits ?? []) {
      if (v.status === 'CANCELADA') continue;
      pushTimed(
        v.visitDatetime,
        v.durationMinutes ?? 60,
        `Visita: ${v.title}`,
        v.visitorName ? `Invitado: ${v.visitorName}` : null,
        `visit-${v.id}`,
        `visita:${v.id}`
      );
    }
    return out;
  }, [meetings, visits, from, to]);

  const weekEvents = useMemo<WeekScheduleEvent[]>(() => {
    if (alumno) {
      const classes = (schedule?.slots ?? []).map((s) => ({
        id: s.id,
        weekday: s.weekday,
        startTime: s.startTime,
        endTime: s.endTime,
        title: s.subjectName ?? 'Clase',
        subtitle: null,
        room: s.room,
        colorKey: s.subjectName ?? s.subjectId ?? s.id
      }));
      return [...classes, ...meetingsAndVisitsGridEvents];
    }
    const classes = (teacherSlots ?? []).map((s) => ({
      id: s.id,
      weekday: s.weekday,
      startTime: s.startTime,
      endTime: s.endTime,
      title: s.subjectName ?? 'Clase',
      subtitle: s.groupName ?? null,
      room: s.room,
      colorKey: s.subjectName ?? s.subjectId ?? s.id
    }));
    return [...classes, ...meetingsAndVisitsGridEvents];
  }, [alumno, schedule?.slots, teacherSlots, meetingsAndVisitsGridEvents]);

  const meetingsThisWeek = useMemo(() => {
    if (!meetings) return [];
    return meetings
      .filter((m) => m.status !== 'CANCELADA')
      .filter((m) => {
        const when = meetingWhenIso(m as MeetingRow & Record<string, unknown>);
        if (!when) return false;
        const dayStr = localDateISO(parseFlexibleInstant(when));
        return isDateInWeek(dayStr, from, to);
      })
      .sort((a, b) =>
        (meetingWhenIso(a as MeetingRow & Record<string, unknown>) ?? '').localeCompare(
          meetingWhenIso(b as MeetingRow & Record<string, unknown>) ?? ''
        )
      );
  }, [meetings, from, to]);

  const visitsThisWeek = useMemo(() => {
    if (!visits) return [];
    return visits
      .filter((v) => v.status !== 'CANCELADA')
      .filter((v) => {
        const dayStr = localDateISO(parseFlexibleInstant(v.visitDatetime));
        return isDateInWeek(dayStr, from, to);
      })
      .sort((a, b) => a.visitDatetime.localeCompare(b.visitDatetime));
  }, [visits, from, to]);
  const meetingsById = useMemo(
    () => new Map(meetingsThisWeek.map((m) => [String(m.id), m] as const)),
    [meetingsThisWeek]
  );
  const visitsById = useMemo(
    () => new Map(visitsThisWeek.map((v) => [String(v.id), v] as const)),
    [visitsThisWeek]
  );

  async function downloadPdf() {
    if (!schedule?.groupId) return;
    try {
      const res = await api.get(`/api/v1/documents/schedule/group/${schedule.groupId}`, {
        responseType: 'blob'
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `horario-${schedule.groupId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(getUserFacingMessage(e, 'No se pudo descargar el PDF.'));
    }
  }

  if (!alumno && !docente) {
    return (
      <p className="text-sm text-slate-600">Esta sección es solo para cuentas de estudiante o docente.</p>
    );
  }

  if (loading && !schedule && !teacherSlots) {
    return <p className="text-slate-600">Cargando horario…</p>;
  }

  return (
    <div className="max-w-5xl animate-fade-in space-y-10">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Mi horario semanal</h1>
        <p className="mt-2 text-sm text-slate-600">
          {alumno
            ? 'Clases de su grupo, reuniones y visitas de la semana elegida, días sin clases y avisos recientes.'
            : 'Sus clases, reuniones y visitas de la semana elegida, días sin clases y avisos recientes.'}
        </p>
      </div>

      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {err}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o - 1)}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            ← Semana anterior
          </button>
          <span className="text-sm font-medium text-slate-800">{label}</span>
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o + 1)}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Semana siguiente →
          </button>
          {weekOffset !== 0 && (
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="text-sm font-medium text-brand-800 underline"
            >
              Hoy
            </button>
          )}
        </div>
        {alumno && schedule?.groupId && (
          <button
            type="button"
            onClick={() => void downloadPdf()}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Descargar PDF del grupo
          </button>
        )}
      </div>

      {alumno && schedule?.group && (
        <p className="text-sm text-slate-700">
          <span className="font-medium text-slate-900">{schedule.group.name}</span>
          {schedule.group.grade ? ` · ${schedule.group.grade}` : ''} · Año {schedule.group.schoolYear}
        </p>
      )}

      {alumno && !schedule?.groupId && (
        <p className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Aún no tiene un grupo asignado: no verá franjas de clase hasta que la secretaría lo asigne. Las reuniones y
          visitas en las que participe pueden seguir mostrándose en la cuadrícula y en los listados de abajo.
        </p>
      )}

      {(alumno ? schedule !== null : teacherSlots !== null) ? (
        <WeekScheduleGrid
          events={weekEvents}
          days={weekDays}
          onSelect={(id) => {
            if (id.startsWith('meeting-') || id.startsWith('visit-')) {
              setOpenCalendarEventId(id);
              return;
            }
            setOpenCalendarEventId(null);
            setOpenSlotId(id);
          }}
          emptyLabel={
            alumno
              ? 'No hay clases, reuniones ni visitas programadas en esta semana.'
              : 'No hay clases, reuniones ni visitas programadas en esta semana.'
          }
        />
      ) : null}

      {(() => {
        const slot = alumno
          ? schedule?.slots?.find((s) => s.id === openSlotId) ?? null
          : teacherSlots?.find((s) => s.id === openSlotId) ?? null;
        const WEEKDAY = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        return (
          <DetailModal
            open={slot !== null}
            title={slot?.subjectName ?? 'Clase'}
            subtitle={
              slot
                ? `${WEEKDAY[slot.weekday] ?? ''} · ${slot.startTime.slice(0, 5)}–${slot.endTime.slice(0, 5)}`
                : undefined
            }
            onClose={() => setOpenSlotId(null)}
          >
            {slot ? (
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">Materia</dt>
                  <dd className="mt-0.5 text-slate-900">{slot.subjectName ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">Día</dt>
                  <dd className="mt-0.5 capitalize text-slate-900">{WEEKDAY[slot.weekday]}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">Horario</dt>
                  <dd className="mt-0.5 text-slate-900">
                    {slot.startTime.slice(0, 5)} – {slot.endTime.slice(0, 5)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">Aula</dt>
                  <dd className="mt-0.5 text-slate-900">{slot.room ?? 'No especificada'}</dd>
                </div>
                {alumno && schedule?.group ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">Grupo</dt>
                    <dd className="mt-0.5 text-slate-900">
                      {schedule.group.name}
                      {schedule.group.grade ? ` · ${schedule.group.grade}` : ''} · Año{' '}
                      {schedule.group.schoolYear}
                    </dd>
                  </div>
                ) : null}
                {!alumno && slot && 'groupName' in slot ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">Grupo</dt>
                    <dd className="mt-0.5 text-slate-900">{(slot as TeacherSelfSlot).groupName ?? '—'}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </DetailModal>
        );
      })()}
      {(() => {
        if (!openCalendarEventId) return null;
        const isMeeting = openCalendarEventId.startsWith('meeting-');
        const rawId = openCalendarEventId.replace(/^meeting-|^visit-/, '');
        const meeting = isMeeting ? meetingsById.get(rawId) ?? null : null;
        const visit = !isMeeting ? visitsById.get(rawId) ?? null : null;
        const when = meeting ? meetingWhenIso(meeting as MeetingRow & Record<string, unknown>) : visit?.visitDatetime ?? null;
        const title = meeting
          ? meeting.title ?? meeting.topic ?? 'Reunión'
          : visit
            ? visit.title
            : 'Evento';
        return (
          <DetailModal
            open={Boolean(meeting || visit)}
            title={isMeeting ? `Reunión: ${title}` : `Visita: ${title}`}
            subtitle={
              when
                ? new Date(when).toLocaleString('es', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : undefined
            }
            onClose={() => setOpenCalendarEventId(null)}
          >
            {meeting ? (
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">Estado</dt>
                  <dd className="mt-0.5 text-slate-900">{meeting.status ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">Modalidad</dt>
                  <dd className="mt-0.5 text-slate-900">
                    {meeting.modality === 'VIRTUAL' ? 'Virtual' : meeting.modality === 'PRESENCIAL' ? 'Presencial' : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">Duración</dt>
                  <dd className="mt-0.5 text-slate-900">{meeting.durationMinutes ?? 30} min</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">Detalle</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-slate-900">{meeting.purpose ?? 'Sin detalle adicional.'}</dd>
                </div>
              </dl>
            ) : visit ? (
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">Invitado</dt>
                  <dd className="mt-0.5 text-slate-900">{visit.visitorName || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">Estado</dt>
                  <dd className="mt-0.5 text-slate-900">{visit.status || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">Duración</dt>
                  <dd className="mt-0.5 text-slate-900">{visit.durationMinutes ?? 60} min</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">Lugar</dt>
                  <dd className="mt-0.5 text-slate-900">{visit.location ?? 'No especificado'}</dd>
                </div>
              </dl>
            ) : null}
          </DetailModal>
        );
      })()}

      <section className="space-y-8">
        <div>
          <h2 className="font-serif text-lg font-semibold text-slate-900">Reuniones de esta semana</h2>
          <p className="mt-1 text-xs text-slate-500">
            Coinciden con la semana mostrada arriba (use los botones de semana si no ve nada).
          </p>
          {meetingsThisWeek.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No hay reuniones en esta semana.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {meetingsThisWeek.map((m) => {
                const when = meetingWhenIso(m as MeetingRow & Record<string, unknown>);
                return (
                  <li key={m.id} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
                    <p className="font-medium text-slate-900">{m.title ?? m.topic ?? 'Reunión'}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {when
                        ? new Date(when).toLocaleString('es', {
                            weekday: 'short',
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : 'Sin fecha'}
                      {m.modality ? ` · ${m.modality === 'VIRTUAL' ? 'Virtual' : 'Presencial'}` : ''}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div>
          <h2 className="font-serif text-lg font-semibold text-slate-900">Visitas de esta semana</h2>
          <p className="mt-1 text-xs text-slate-500">
            Visitas externas donde participa su grupo o la escuela según lo programado
            {alumno ? ' (incluye visitas dirigidas a su curso).' : '.'}
          </p>
          {visitsThisWeek.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No hay visitas en esta semana.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {visitsThisWeek.map((v) => (
                <li key={v.id} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
                  <p className="font-medium text-slate-900">{v.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {new Date(v.visitDatetime).toLocaleString('es', {
                      weekday: 'short',
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                    {v.visitorName ? ` · ${v.visitorName}` : ''}
                    {v.location ? ` · ${v.location}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-serif text-lg font-semibold text-slate-900">Días sin clases de esta semana</h2>
        <p className="mt-1 text-xs text-slate-500">
          Incluye los días sin clases para toda la escuela y los específicos de su grupo.
        </p>
        {weekCalendarDays.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No hay días marcados sin clases en esta semana.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {weekCalendarDays.map((d) => (
              <li
                key={d.id}
                className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
              >
                <span className="font-medium text-slate-900">
                  {new Date(d.exceptionDate.slice(0, 10) + 'T12:00:00').toLocaleDateString('es', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long'
                  })}
                </span>
                {d.reason ? <span className="mt-1 block text-slate-600">{d.reason}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-serif text-lg font-semibold text-slate-900">Avisos recientes (notificaciones)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Comunicados enviados a su usuario (incluye avisos institucionales que se le hayan dirigido).
        </p>
        {!notifications || notifications.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No hay notificaciones recientes.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`rounded-lg border px-4 py-3 text-sm shadow-sm ${
                  n.readAt ? 'border-slate-200 bg-white' : 'border-brand-200/60 bg-brand-50/50'
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-slate-900">{n.title}</span>
                  <time className="text-xs text-slate-500" dateTime={n.sentAt}>
                    {new Date(n.sentAt).toLocaleString('es')}
                  </time>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-slate-700">{n.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
