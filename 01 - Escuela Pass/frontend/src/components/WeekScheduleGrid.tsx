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

/** Height in px for each full hour row. Larger value = more breathing room per event. */
const ROW_HEIGHT_PX = 72;

/** Width of the time-label column in px. */
const TIME_COL_PX = 56;

/**
 * Modern palette: light tinted background + vivid left-border accent.
 * bg     = card fill (very light tint)
 * border = left accent strip
 * text   = primary text color
 * time   = de-emphasized time text
 */
const COLOR_PALETTE: { bg: string; border: string; text: string; time: string }[] = [
  { bg: 'bg-sky-50 dark:bg-sky-950/45', border: 'border-sky-500 dark:border-sky-400', text: 'text-sky-900 dark:text-sky-50', time: 'text-sky-600 dark:text-sky-300' },
  { bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-500 dark:border-amber-400', text: 'text-amber-900 dark:text-amber-50', time: 'text-amber-600 dark:text-amber-300' },
  { bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-500 dark:border-emerald-400', text: 'text-emerald-900 dark:text-emerald-50', time: 'text-emerald-600 dark:text-emerald-300' },
  { bg: 'bg-rose-50 dark:bg-rose-950/40', border: 'border-rose-500 dark:border-rose-400', text: 'text-rose-900 dark:text-rose-50', time: 'text-rose-600 dark:text-rose-300' },
  { bg: 'bg-violet-50 dark:bg-violet-950/40', border: 'border-violet-500 dark:border-violet-400', text: 'text-violet-900 dark:text-violet-50', time: 'text-violet-600 dark:text-violet-300' },
  { bg: 'bg-orange-50 dark:bg-orange-950/40', border: 'border-orange-500 dark:border-orange-400', text: 'text-orange-900 dark:text-orange-50', time: 'text-orange-600 dark:text-orange-300' },
  { bg: 'bg-cyan-50 dark:bg-cyan-950/40', border: 'border-cyan-500 dark:border-cyan-400', text: 'text-cyan-900 dark:text-cyan-50', time: 'text-cyan-600 dark:text-cyan-300' },
  { bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/40', border: 'border-fuchsia-500 dark:border-fuchsia-400', text: 'text-fuchsia-900 dark:text-fuchsia-50', time: 'text-fuchsia-600 dark:text-fuchsia-300' },
  { bg: 'bg-lime-50 dark:bg-lime-950/35', border: 'border-lime-500 dark:border-lime-400', text: 'text-lime-900 dark:text-lime-50', time: 'text-lime-700 dark:text-lime-300' },
  { bg: 'bg-indigo-50 dark:bg-indigo-950/45', border: 'border-indigo-500 dark:border-indigo-400', text: 'text-indigo-900 dark:text-indigo-50', time: 'text-indigo-600 dark:text-indigo-300' }
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

function colorForKey(key: string | null | undefined): { bg: string; border: string; text: string; time: string } {
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
  laneIndex: number;
  laneCount: number;
};

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

function PinIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className ?? 'h-3 w-3'}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M8 1.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9ZM2 6a6 6 0 1 1 10.743 3.684l2.537 2.537a.75.75 0 1 1-1.06 1.06l-2.538-2.537A6 6 0 0 1 2 6Z"
        clipRule="evenodd"
      />
      <path d="M8 7.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
    </svg>
  );
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
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/30">
      <div style={{ minWidth: `${TIME_COL_PX + orderedDays.length * 110}px` }}>

        {/* ── Header row ── */}
        <div
          className="grid border-b border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/80"
          style={{ gridTemplateColumns: `${TIME_COL_PX}px repeat(${orderedDays.length}, minmax(0, 1fr))` }}
        >
          {/* Time column header */}
          <div className="flex items-end justify-end px-2 pb-2 pt-3">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              hr
            </span>
          </div>

          {orderedDays.map((d) => {
            const isTodayCol = d.dateISO ? d.dateISO === todayISO : d.weekday === todayWeekday;
            return (
              <div
                key={d.weekday}
                className={`border-l border-slate-200 px-2 pb-2 pt-3 text-center dark:border-slate-700 ${
                  isTodayCol ? 'bg-brand-50/60 dark:bg-brand-950/35' : ''
                }`}
              >
                {/* Day abbreviation */}
                <div
                  className={`text-[10px] font-bold uppercase tracking-widest ${
                    isTodayCol ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {WEEKDAY_SHORT[d.weekday]}
                </div>

                {/* Date number or long name */}
                {d.dateISO ? (
                  <div className="mt-1 flex items-center justify-center">
                    {isTodayCol ? (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white shadow-sm">
                        {Number.parseInt(d.dateISO.slice(8, 10), 10)}
                      </span>
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {Number.parseInt(d.dateISO.slice(8, 10), 10)}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className={`mt-1 text-xs font-medium capitalize ${isTodayCol ? 'text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300'}`}>
                    {WEEKDAY_LONG[d.weekday]}
                  </div>
                )}

                {/* Off-day badge */}
                {d.isOff ? (
                  <div className="mx-auto mt-1.5 inline-block max-w-full rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                    Sin clases{d.offReason ? ` · ${d.offReason}` : ''}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* ── Body: time axis + day columns ── */}
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: `${TIME_COL_PX}px repeat(${orderedDays.length}, minmax(0, 1fr))`,
            height: `${totalHeight}px`
          }}
        >
          {/* Time labels column */}
          <div className="relative bg-slate-50/60 dark:bg-slate-800/50">
            {hours.map((h, i) => (
              <div
                key={h}
                className="absolute inset-x-0 flex justify-end pr-2"
                style={{ top: `${i * ROW_HEIGHT_PX}px` }}
              >
                {/* Label sits right on the hour line */}
                <span
                  className="relative -top-2.5 text-[10px] font-medium tabular-nums text-slate-400 dark:text-slate-500"
                  style={{ lineHeight: 1 }}
                >
                  {minutesToHHMM(h * 60)}
                </span>
              </div>
            ))}
            {/* Bottom boundary label */}
            <div
              className="absolute inset-x-0 flex justify-end pr-2"
              style={{ top: `${totalHeight}px` }}
            >
              <span
                className="relative -top-2.5 text-[10px] font-medium tabular-nums text-slate-400 dark:text-slate-500"
                style={{ lineHeight: 1 }}
              >
                {minutesToHHMM(endHour * 60)}
              </span>
            </div>
          </div>

          {/* Day columns */}
          {orderedDays.map((d) => {
            const dayEvents = layoutDay(eventsByDay.get(d.weekday) ?? []);
            const isTodayCol = d.dateISO ? d.dateISO === todayISO : d.weekday === todayWeekday;
            return (
              <div
                key={d.weekday}
                className={`relative border-l border-slate-200 dark:border-slate-700 ${
                  d.isOff
                    ? 'bg-amber-50/30 dark:bg-amber-950/20'
                    : isTodayCol
                      ? 'bg-brand-50/20 dark:bg-brand-950/25'
                      : 'bg-white dark:bg-slate-900/60'
                }`}
              >
                {/* Full-hour dividers */}
                {hours.map((h, i) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-t border-slate-100 dark:border-slate-700/90"
                    style={{ top: `${i * ROW_HEIGHT_PX}px` }}
                  />
                ))}

                {/* Half-hour dividers (dashed, subtle) */}
                {hours.map((h) => (
                  <div
                    key={`half-${h}`}
                    className="absolute inset-x-0 border-t border-dashed border-slate-100/80 dark:border-slate-600/50"
                    style={{ top: `${(hours.indexOf(h) + 0.5) * ROW_HEIGHT_PX}px` }}
                  />
                ))}

                {/* Bottom boundary line */}
                <div
                  className="absolute inset-x-0 border-t border-slate-100 dark:border-slate-700/90"
                  style={{ top: `${totalHeight}px` }}
                />

                {/* Events */}
                {dayEvents.map((ev) => {
                  const top = ((ev.startMinutes - startHour * 60) / totalMinutes) * totalHeight;
                  const height = Math.max(
                    28,
                    ((ev.endMinutes - ev.startMinutes) / totalMinutes) * totalHeight - 3
                  );
                  const colWidth = 100 / ev.laneCount;
                  const left = ev.laneIndex * colWidth;
                  const palette = colorForKey(ev.colorKey ?? ev.title);

                  const showTimeRange = height >= 44;
                  const showSubtitle = height >= 56 && !!ev.subtitle;
                  const showRoom = height >= 68 && !!ev.room;

                  const Comp = onSelect ? 'button' : 'div';
                  return (
                    <Comp
                      key={ev.id}
                      type={onSelect ? 'button' : undefined}
                      onClick={onSelect ? () => onSelect(ev.id) : undefined}
                      className={`absolute z-10 flex flex-col overflow-hidden rounded-lg border-l-[3px] bg-white px-2 py-1 text-left shadow-sm ring-1 ring-slate-200/60 transition-all hover:z-20 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70 dark:bg-slate-800/95 dark:shadow-slate-950/40 dark:ring-slate-600/40 ${palette.border} ${
                        onSelect ? 'cursor-pointer dark:hover:bg-slate-800' : ''
                      }`}
                      style={{
                        top: `${top + 2}px`,
                        height: `${height}px`,
                        left: `calc(${left}% + 3px)`,
                        width: `calc(${colWidth}% - 6px)`
                      }}
                      title={`${ev.title}${ev.subtitle ? ` · ${ev.subtitle}` : ''} · ${ev.startTime.slice(0, 5)}–${ev.endTime.slice(0, 5)}${ev.room ? ` · ${ev.room}` : ''}`}
                    >
                      {/* Time row */}
                      <div className={`flex items-center gap-1 text-[10px] font-semibold tabular-nums leading-none ${palette.time}`}>
                        <span>{ev.startTime.slice(0, 5)}</span>
                        {showTimeRange ? (
                          <span className="opacity-70">– {ev.endTime.slice(0, 5)}</span>
                        ) : null}
                      </div>

                      {/* Title */}
                      <div className={`mt-0.5 line-clamp-2 text-[11px] font-semibold leading-snug ${palette.text}`}>
                        {ev.title}
                      </div>

                      {/* Subtitle */}
                      {showSubtitle ? (
                        <div className={`mt-0.5 line-clamp-1 text-[10px] opacity-80 ${palette.text}`}>
                          {ev.subtitle}
                        </div>
                      ) : null}

                      {/* Room */}
                      {showRoom ? (
                        <div className={`mt-0.5 flex items-center gap-1 text-[10px] opacity-70 ${palette.text}`}>
                          <PinIcon className="h-2.5 w-2.5 shrink-0" />
                          <span className="line-clamp-1">{ev.room}</span>
                        </div>
                      ) : null}
                    </Comp>
                  );
                })}
              </div>
            );
          })}
        </div>

        {!hasAnyEvent ? (
          <p className="border-t border-slate-200 px-4 py-8 text-center text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
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
