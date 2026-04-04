/** Transiciones que puede aplicar personal (alineado al backend). */
/** Alineado al backend: la entrega final la confirma el padre (o consentimiento solo por institución). */
export const STAFF_ALLOWED_NEXT: Record<string, string[]> = {
  PENDIENTE: ['PADRE_EN_CAMINO', 'NOTIFICADO_LLEGADA', 'CANCELADO', 'CONSENTIDO_SOLO'],
  PADRE_EN_CAMINO: ['NOTIFICADO_LLEGADA', 'CANCELADO'],
  NOTIFICADO_LLEGADA: ['AUTORIZADO_SALIR', 'CANCELADO'],
  AUTORIZADO_SALIR: ['EN_CAMINO', 'CANCELADO'],
  EN_CAMINO: ['CANCELADO'],
  ENTREGADO: [],
  CERRADO_SIN_CONFIRMACION_PADRE: [],
  CONSENTIDO_SOLO: ['ENTREGADO', 'CANCELADO'],
  CANCELADO: []
};
