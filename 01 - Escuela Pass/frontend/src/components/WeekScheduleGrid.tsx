import { useMemo } from 'react';

export type WeekScheduleEvent = {
  id: string;
  /** 0 = domingo … 6 = sábado (convención `Date.getDay`). */
  weekday: number;
  /** `HH:MM` o `HH:MM:SS`. */
  startTime: string;
  /** `HH:MM` o `HH:MM:SS`. */
  endTime: string;
  title: string;
  subtitle?: string | null;
  room?: string | null;
  /** Texto base para asignar el color (p.ej. nombre de materia). */
  colorKey?: string | null;
};

export type WeekScheduleDayMeta = {
  /** 0 = domingo … 6 = sábado. */
  weekday: number;
  /** Fecha ISO `YYYY-MM-DD` para la cabecera. */
  dateISO?: string;
  /** Día sin clases en esta fecha. */
  isOff?: boolean;
  /** Motivo opcional del día sin clases. */
  offReason?: string | null;
};

type Props = {
  events: WeekScheduleEvent[];
  /** Datos de cada día visible (solo los días incluidos en este arreglo se renderizan). */
  days: WeekScheduleDayMeta[];
  /** Hora mínima del eje (entero, 0–23). Por defecto se calcula a partir de los eventos. */
  minHour?: number;
  /** Hora máxima del eje exclusiva (entero, 1–24). Por defecto se calcula a partir de los eventos. */
  maxHour?: number;
  /** Acción opcional al pulsar un evento (útil para detalles). */
  onSelect?: (eventId: string) => void;
  /** Texto vacío cuando no hay eventos en absoluto. */
  emptyLabel?: string;
};

const WEEKDAY_LONG = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado'
];

const WEEKDAY_SHORT = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

const ROW_HEIGHT_PX = 56;

const COLOR_PALETTE: { bg: string; ring: string; text: string }[] = [
  { bg: 'bg-sky-500/90', ring: 'ring-sky-700', text: 'text-white' },
  { bg: 'bg-amber-500/90', ring: 'ring-amber-700', text: 'text-amber-950' },
  { bg: 'bg-emerald-500/90', ring: 'ring-emerald-700', text: 'text-white' },
  { bg: 'bg-rose-500/90', ring: 'ring-rose-700', text: 'text-white' },
  { bg: 'bg-violet-500/90', ring: 'ring-violet-700', text: 'text-white' },
  { bg: 'bg-orange-500/90', ring: 'ring-orange-700', text: 'text-white' },
  { bg: 'bg-cyan-500/90', ring: 'ring-cyan-700', text: 'text-white' },
  { bg: 'bg-fuchsia-500/90', ring: 'ring-fuchsia-700', text: 'text-white' },
  { bg: 'bg-lime-500/90', ring: 'ring-lime-700', text: 'text-lime-950' },
  { bg: 'bg-indigo-500/90', ring: 'ring-indigo-700', text: 'text-white' }
];

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':');
  const hi = Number.parseInt(h ?? '0', 10);
  const mi = Number.parseInt(m ?? '0', 10);
  return (Number.isFinite(hi) ? hi : 0) * 60 + (Number.isFinite(mi) ? mi : 0);
}

function minutesToHHMM(total: number): string {
  const h = Math.floor(total / 60).toString().padStart(2, '0');
  const m = (total % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function colorForKey(key: string | null | undefined): { bg: string; ring: string; text: string } {
  const safe = (key ?? '').trim();
  if (!safe) return COLOR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < safe.length; i += 1) {
    hash = (hash * 31 + safe.charCodeAt(i)) >>> 0;
  }
  return COLOR_PALETTE[hash % COLOR_PALETTE.length];
}

type LaidOutEvent = WeekScheduleEvent & {
  startMinutes: number;
  endMinutes: number;
  /** Lane asignado dentro del cluster de solapamiento. */
  laneIndex: number;
  /** Total de lanes del cluster (para calcular ancho). */
  laneCount: number;
};

/** Algoritmo de "lanes" tipo Google Calendar: agrupa eventos solapados y reparte columnas. */
function layoutDay(events: WeekScheduleEvent[]): LaidOutEvent[] {
  const sorted = events
    .map((e) => ({
      ...e,
      startMinutes: timeToMinutes(e.startTime),
      endMinutes: timeToMinutes(e.endTime)
    }))
    .filter((e) => e.endMinutes > e.startMinutes)
    .sort((a, b) => a.startMinutes - b.startMinutes || b.endMinutes - a.endMinutes);

  const laidOut: LaidOutEvent[] = [];
  let cluster: { events: LaidOutEvent[]; lanesEnd: number[]; clusterEnd: number } | null = null;

  const flush = () => {
    if (!cluster) return;
    const count = cluster.lanesEnd.length;
    for (const ev of cluster.events) {
      ev.laneCount = count;
    }
    cluster = null;
  };

  for (const ev of sorted) {
    if (!cluster || ev.startMinutes >= cluster.clusterEnd) {
      flush();
      cluster = { events: [], lanesEnd: [], clusterEnd: ev.endMinutes };
    }
    let laneIndex = cluster.lanesEnd.findIndex((endAt) => endAt <= ev.startMinutes);
    if (laneIndex === -1) {
      laneIndex = cluster.lanesEnd.length;
      cluster.lanesEnd.push(ev.endMinutes);
    } else {
      cluster.lanesEnd[laneIndex] = ev.endMinutes;
    }
    cluster.clusterEnd = Math.max(cluster.clusterEnd, ev.endMinutes);
    const laidEvent: LaidOutEvent = { ...ev, laneIndex, laneCount: 1 };
    cluster.events.push(laidEvent);
    laidOut.push(laidEvent);
  }
  flush();

  return laidOut;
}

export function WeekScheduleGrid({
  events,
  days,
  minHour,
  maxHour,
  onSelect,
  emptyLabel = 'No hay franjas en esta semana.'
}: Props) {
  const orderedDays = useMemo(
    () =>
      [...days].sort((a, b) => {
        const orderA = a.weekday === 0 ? 7 : a.weekday;
        const orderB = b.weekday === 0 ? 7 : b.weekday;
        return orderA - orderB;
      }),
    [days]
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<number, WeekScheduleEvent[]>();
    for (const e of events) {
      const list = map.get(e.weekday) ?? [];
      list.push(e);
      map.set(e.weekday, list);
    }
    return map;
  }, [events]);

  const { startHour, endHour, hours } = useMemo(() => {
    let lo = minHour ?? 7;
    let hi = maxHour ?? 18;
    let computedLo = Number.POSITIVE_INFINITY;
    let computedHi = Number.NEGATIVE_INFINITY;
    for (const e of events) {
      const s = timeToMinutes(e.startTime);
      const x = timeToMinutes(e.endTime);
      if (s < computedLo) computedLo = s;
      if (x > computedHi) computedHi = x;
    }
    if (Number.isFinite(computedLo) && minHour === undefined) {
      lo = Math.max(0, Math.min(lo, Math.floor(computedLo / 60)));
    }
    if (Number.isFinite(computedHi) && maxHour === undefined) {
      hi = Math.min(24, Math.max(hi, Math.ceil(computedHi / 60)));
    }
    if (hi - lo < 6) {
      hi = Math.min(24, lo + 6);
    }
    const list: number[] = [];
    for (let h = lo; h < hi; h += 1) list.push(h);
    return { startHour: lo, endHour: hi, hours: list };
  }, [events, minHour, maxHour]);

  const totalMinutes = (endHour - startHour) * 60;
  const totalHeight = (endHour - startHour) * ROW_HEIGHT_PX;
  const hasAnyEvent = events.length > 0;

  const todayWeekday = useMemo(() => new Date().getDay(), []);
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="min-w-[760px]">
        <div
          className="grid border-b border-slate-200 bg-slate-50"
          style={{ gridTemplateColumns: `64px repeat(${orderedDays.length}, minmax(0, 1fr))` }}
        >
          <div className="px-2 py-3 text-[10px] font-medium uppercase tracking-widest text-slate-500">
            Hora
          </div>
          {orderedDays.map((d) => {
            const isTodayCol = d.dateISO ? d.dateISO === todayISO : d.weekday === todayWeekday;
            return (
              <div
                key={d.weekday}
                className={`border-l border-slate-200 px-2 py-2 text-center text-xs ${
                  isTodayCol ? 'bg-brand-50/70 text-brand-900' : 'text-slate-700'
                }`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-widest">
                  {WEEKDAY_SHORT[d.weekday]}
                </div>
                {d.dateISO ? (
                  <div className="mt-0.5 text-base font-semibold tabular-nums">
                    {Number.parseInt(d.dateISO.slice(8, 10), 10)}
                  </div>
                ) : (
                  <div className="mt-0.5 text-sm font-medium capitalize">{WEEKDAY_LONG[d.weekday]}</div>
                )}
                {d.isOff ? (
                  <div className="mx-auto mt-1 inline-block max-w-full truncate rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                    Sin clases{d.offReason ? ` · ${d.offReason}` : ''}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div
          className="relative grid"
          style={{
            gridTemplateColumns: `64px repeat(${orderedDays.length}, minmax(0, 1fr))`,
            height: `${totalHeight}px`
          }}
        >
          <div className="relative">
            {hours.map((h, i) => (
              <div
                key={h}
                className="absolute inset-x-0 flex items-start justify-end pr-2 text-[11px] tabular-nums text-slate-500"
                style={{ top: `${i * ROW_HEIGHT_PX}px`, height: `${ROW_HEIGHT_PX}px` }}
              >
                <span className="-translate-y-1.5">{minutesToHHMM(h * 60)}</span>
              </div>
            ))}
          </div>

          {orderedDays.map((d) => {
            const dayEvents = layoutDay(eventsByDay.get(d.weekday) ?? []);
            const isTodayCol = d.dateISO ? d.dateISO === todayISO : d.weekday === todayWeekday;
            return (
              <div
                key={d.weekday}
                className={`relative border-l border-slate-200 ${
                  d.isOff ? 'bg-amber-50/40' : isTodayCol ? 'bg-brand-50/30' : 'bg-white'
                }`}
              >
                {hours.map((h, i) => (
                  <div
                    key={h}
                    className={`absolute inset-x-0 ${
                      i === hours.length - 1 ? '' : 'border-b border-slate-100'
                    }`}
                    style={{ top: `${i * ROW_HEIGHT_PX}px`, height: `${ROW_HEIGHT_PX}px` }}
                  />
                ))}

                {dayEvents.map((ev) => {
                  const top = ((ev.startMinutes - startHour * 60) / totalMinutes) * totalHeight;
                  const height = Math.max(
                    24,
                    ((ev.endMinutes - ev.startMinutes) / totalMinutes) * totalHeight - 2
                  );
                  const colWidth = 100 / ev.laneCount;
                  const left = ev.laneIndex * colWidth;
                  const palette = colorForKey(ev.colorKey ?? ev.title);
                  const compact = height < 50;
                  const Comp = onSelect ? 'button' : 'div';
                  return (
                    <Comp
                      key={ev.id}
                      type={onSelect ? 'button' : undefined}
                      onClick={onSelect ? () => onSelect(ev.id) : undefined}
                      className={`absolute z-10 flex flex-col gap-0.5 overflow-hidden rounded-md px-2 py-1 text-left text-[11px] leading-tight shadow-sm ring-1 ring-inset transition hover:z-20 hover:shadow-md focus:outline-none focus:ring-2 ${palette.bg} ${palette.ring} ${palette.text}`}
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        left: `calc(${left}% + 2px)`,
                        width: `calc(${colWidth}% - 4px)`
                      }}
                      title={`${ev.title}${ev.subtitle ? ` · ${ev.subtitle}` : ''} · ${ev.startTime.slice(0, 5)}–${ev.endTime.slice(0, 5)}${ev.room ? ` · ${ev.room}` : ''}`}
                    >
                      <div className="flex items-baseline gap-1 text-[10px] font-semibold opacity-90 tabular-nums">
                        <span>{ev.startTime.slice(0, 5)}</span>
                        {!compact ? <span className="opacity-70">–{ev.endTime.slice(0, 5)}</span> : null}
                      </div>
                      <div className="line-clamp-2 text-xs font-semibold">{ev.title}</div>
                      {!compact && ev.subtitle ? (
                        <div className="line-clamp-1 text-[10px] opacity-90">{ev.subtitle}</div>
                      ) : null}
                      {!compact && ev.room ? (
                        <div className="text-[10px] opacity-80">📍 {ev.room}</div>
                      ) : null}
                    </Comp>
                  );
                })}
              </div>
            );
          })}
        </div>

        {!hasAnyEvent ? (
          <p className="border-t border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
            {emptyLabel}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Helper para construir los `WeekScheduleDayMeta` de la semana visible (lunes → domingo)
 * a partir del rango ISO `YYYY-MM-DD` que ya manejan las páginas.
 */
export function buildWeekDays(fromISO: string, dayOffByISO?: Map<string, string | null>): WeekScheduleDayMeta[] {
  const start = new Date(`${fromISO}T12:00:00`);
  const days: WeekScheduleDayMeta[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const off = dayOffByISO?.get(iso);
    days.push({
      weekday: d.getDay(),
      dateISO: iso,
      isOff: off !== undefined,
      offReason: off ?? undefined
    });
  }
  return days;
}
