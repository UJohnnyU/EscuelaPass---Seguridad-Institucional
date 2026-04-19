import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { getUserFacingMessage } from '@/lib/api-errors';
import { useAuth } from '@/context/useAuth';
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

type CalendarDay = {
  id: string;
  exceptionDate: string;
  groupId: string | null;
  reason: string | null;
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

export function StudentSchedulePage() {
  const { user } = useAuth();
  const [weekOffset, setWeekOffset] = useState(0);
  const { from, to, label } = useMemo(() => weekRangeISO(weekOffset), [weekOffset]);

  const [schedule, setSchedule] = useState<SchedulePayload | null>(null);
  const [calendar, setCalendar] = useState<{ groupId: string | null; days: CalendarDay[] } | null>(null);
  const [notifications, setNotifications] = useState<NotifRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (user?.role !== 'ALUMNO') return;
    setErr(null);
    setLoading(true);
    try {
      const [sRes, cRes, nRes] = await Promise.all([
        api.get<SchedulePayload>('/api/v1/schedules/me/student'),
        api.get<{ groupId: string | null; days: CalendarDay[] }>(
          `/api/v1/calendar/me/student?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
        ),
        api.get<{ data: NotifRow[] }>('/api/v1/notifications/me?limit=25')
      ]);
      setSchedule(sRes.data);
      setCalendar(cRes.data);
      setNotifications(nRes.data.data ?? []);
    } catch (e) {
      setErr(getUserFacingMessage(e, 'No se pudo cargar el horario.'));
      setSchedule(null);
      setCalendar(null);
      setNotifications(null);
    } finally {
      setLoading(false);
    }
  }, [user?.role, from, to]);

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

  const weekEvents = useMemo<WeekScheduleEvent[]>(() => {
    return (schedule?.slots ?? []).map((s) => ({
      id: s.id,
      weekday: s.weekday,
      startTime: s.startTime,
      endTime: s.endTime,
      title: s.subjectName ?? 'Clase',
      subtitle: null,
      room: s.room,
      colorKey: s.subjectName ?? s.subjectId ?? s.id
    }));
  }, [schedule?.slots]);

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

  if (user?.role !== 'ALUMNO') {
    return (
      <p className="text-sm text-slate-600">Esta sección es solo para cuentas de estudiante.</p>
    );
  }

  if (loading && !schedule) {
    return <p className="text-slate-600">Cargando horario…</p>;
  }

  return (
    <div className="max-w-5xl animate-fade-in space-y-10">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-slate-900">Mi horario semanal</h1>
        <p className="mt-2 text-sm text-slate-600">
          Clases de su grupo, días sin clases publicados en el calendario y avisos enviados a su cuenta.
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
        {schedule?.groupId && (
          <button
            type="button"
            onClick={() => void downloadPdf()}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Descargar PDF del grupo
          </button>
        )}
      </div>

      {schedule?.group && (
        <p className="text-sm text-slate-700">
          <span className="font-medium text-slate-900">{schedule.group.name}</span>
          {schedule.group.grade ? ` · ${schedule.group.grade}` : ''} · Año {schedule.group.schoolYear}
        </p>
      )}

      {!schedule?.groupId && (
        <p className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Su cuenta aún no tiene un grupo asignado. Cuando secretaría lo registre, verá aquí el horario.
        </p>
      )}

      {schedule?.groupId ? (
        <WeekScheduleGrid
          events={weekEvents}
          days={weekDays}
          emptyLabel="No hay franjas cargadas para su grupo."
        />
      ) : null}

      <section>
        <h2 className="font-serif text-lg font-semibold text-slate-900">Calendario: días sin clases (esta semana)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Incluye suspensiones para toda la institución o para su grupo cuando la institución las publica.
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
