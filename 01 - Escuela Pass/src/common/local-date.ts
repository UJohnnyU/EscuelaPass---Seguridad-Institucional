/**
 * Zona horaria institucional (vencimientos, cierre de periodos, cartera).
 * Override: variable de entorno `APP_TIMEZONE` (IANA), p. ej. `America/Mazatlan`.
 */
export const DEFAULT_APP_TIMEZONE = 'America/Mexico_City';

export function getAppTimeZone(): string {
  const t = process.env.APP_TIMEZONE?.trim();
  return t && t.length > 0 ? t : DEFAULT_APP_TIMEZONE;
}

/**
 * Fecha calendario YYYY-MM-DD en una zona IANA concreta (no en UTC ni en la hora del host).
 */
export function calendarDateInTimeZone(instant: Date, timeZone: string = getAppTimeZone()): string {
  return instant.toLocaleDateString('en-CA', { timeZone });
}

/** “Hoy” calendario según la zona de la aplicación (cierres automáticos sin usuario en sesión). */
export function todayInAppTimezone(): string {
  return calendarDateInTimeZone(new Date());
}

/**
 * Fecha calendario en la zona horaria del proceso (p. ej. servidor).
 * Preferible a `toISOString().slice(0, 10)` (UTC) para reglas de negocio por día escolar.
 */
export function todayLocalISODate(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, '0');
  const d = String(n.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
