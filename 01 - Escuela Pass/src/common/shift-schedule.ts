import { getAppTimeZone } from './local-date';

/** Convierte HH:mm a HH:mm:ss para columnas TIME de PostgreSQL. */
export function timeHmToSql(hm: string): string {
  const t = hm.trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;
  if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;
  throw new Error(`Formato de hora inválido: ${hm}`);
}

/** Minutos desde medianoche a partir de HH:mm o HH:mm:ss. */
export function parseTimeToMinutes(hms: string | null | undefined): number | null {
  if (hms == null || String(hms).trim() === '') return null;
  const s = String(hms).trim();
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh > 23 || mm > 59) return null;
  return hh * 60 + mm;
}

export function minutesSinceMidnightInTimeZone(
  timeZone: string = getAppTimeZone(),
  instant: Date = new Date()
): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(instant);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

/** HH:mm para mostrar en API (recorta segundos). */
export function formatTimeForDisplay(hms: string | null | undefined): string | null {
  if (hms == null || String(hms).trim() === '') return null;
  const s = String(hms).trim();
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s);
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

export function assertWindowStartBeforeEnd(startHm: string, endHm: string): void {
  const a = parseTimeToMinutes(timeHmToSql(startHm));
  const b = parseTimeToMinutes(timeHmToSql(endHm));
  if (a === null || b === null) return;
  if (a >= b) {
    throw new Error('En cada jornada, la hora de inicio debe ser anterior a la de fin');
  }
}
