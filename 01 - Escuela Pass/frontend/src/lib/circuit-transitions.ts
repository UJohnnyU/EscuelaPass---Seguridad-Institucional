/** Transiciones que puede aplicar personal (alineado al backend). */
/** Alineado al backend: la entrega final la confirma el padre (o consentimiento solo por institución). */
export const STAFF_ALLOWED_NEXT: Record<string, string[]> = {
  PENDIENTE: ['PADRE_EN_CAMINO', 'CANCELADO', 'CONSENTIDO_SOLO'],
  PADRE_EN_CAMINO: ['CANCELADO'],
  NOTIFICADO_LLEGADA: ['AUTORIZADO_SALIR', 'PADRE_EN_CAMINO', 'CANCELADO'],
  AUTORIZADO_SALIR: ['EN_CAMINO', 'CANCELADO'],
  EN_CAMINO: ['CANCELADO'],
  ENTREGADO: [],
  CERRADO_SIN_CONFIRMACION_PADRE: [],
  CONSENTIDO_SOLO: ['ENTREGADO', 'CANCELADO'],
  CANCELADO: []
};

/**
 * Un solo paso siguiente en el flujo operativo “feliz” (sin saltos en la UI).
 * Debe existir en STAFF_ALLOWED_NEXT para el estado actual.
 */
const STAFF_PRIMARY_CHAIN: Record<string, string | null> = {
  PENDIENTE: 'PADRE_EN_CAMINO',
  PADRE_EN_CAMINO: null,
  NOTIFICADO_LLEGADA: 'AUTORIZADO_SALIR',
  AUTORIZADO_SALIR: 'EN_CAMINO',
  EN_CAMINO: null,
  CONSENTIDO_SOLO: 'ENTREGADO'
};

export function getPrimaryNextOperationalStatus(status: string): string | null {
  const next = STAFF_PRIMARY_CHAIN[status];
  if (next === undefined || next === null) return null;
  const allowed = STAFF_ALLOWED_NEXT[status] ?? [];
  return allowed.includes(next) ? next : null;
}
