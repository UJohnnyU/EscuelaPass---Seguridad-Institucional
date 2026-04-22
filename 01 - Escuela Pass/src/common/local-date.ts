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
