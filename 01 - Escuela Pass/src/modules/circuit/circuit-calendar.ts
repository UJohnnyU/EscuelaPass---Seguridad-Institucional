/**
 * Calendario operativo del circuito de recogida: misma zona que el resto de reglas de negocio
 * (p. ej. `APP_TIMEZONE` en env, por defecto México central).
 */
export const DEFAULT_CIRCUIT_TIMEZONE = 'America/Mexico_City';

/** IANA p. ej. America/Mexico_City — usar en SQL `timezone($1::text, …)`. */
export function getCircuitTimezone(): string {
  const z = process.env.APP_TIMEZONE?.trim();
  return z || DEFAULT_CIRCUIT_TIMEZONE;
}

/** Fecha local YYYY-MM-DD en la zona del circuito. */
export function todayYmdInCircuitTimezone(): string {
  const tz = getCircuitTimezone();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  if (!y || !m || !d) {
    return new Date().toISOString().slice(0, 10);
  }
  return `${y}-${m}-${d}`;
}
