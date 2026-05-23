/** Fechas calendario institucionales (zona IANA, alineada con APP_TIMEZONE del backend). */

export const DEFAULT_APP_TIMEZONE = 'America/Mexico_City';

export function getAppTimeZone(): string {
  const fromEnv = import.meta.env.VITE_APP_TIMEZONE?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_APP_TIMEZONE;
}

export function calendarDateInTimeZone(instant: Date, timeZone: string = getAppTimeZone()): string {
  return instant.toLocaleDateString('en-CA', { timeZone });
}

export function todayInAppTimezone(): string {
  return calendarDateInTimeZone(new Date());
}

/** Formatea un Date como YYYY-MM-DD en la zona institucional. */
export function formatDateYmd(d: Date): string {
  return calendarDateInTimeZone(d);
}

/** Suma días a una fecha YYYY-MM-DD (sin desfase por UTC). */
export function addCalendarDaysYmd(isoDate: string, deltaDays: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

/** Lunes–domingo de la semana en APP_TIMEZONE (offset en semanas). */
export function mondayWeekRangeYmd(offsetWeeks = 0): { from: string; to: string } {
  const today = todayInAppTimezone();
  const start = new Date(`${today}T12:00:00.000Z`);
  const dow = start.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  start.setUTCDate(start.getUTCDate() + diff + offsetWeeks * 7);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}
