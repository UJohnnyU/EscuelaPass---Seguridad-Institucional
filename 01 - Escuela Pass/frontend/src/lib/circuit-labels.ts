export const CIRCUIT_STATUS_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente de salida',
  PADRE_EN_CAMINO: 'Familia en camino',
  NOTIFICADO_LLEGADA: 'Llegada notificada',
  AUTORIZADO_SALIR: 'Autorizado para salir',
  EN_CAMINO: 'En camino a la salida',
  ENTREGADO: 'Entregado (confirmado por la familia)',
  CERRADO_SIN_CONFIRMACION_PADRE: 'Cerrado sin confirmación final del padre',
  CONSENTIDO_SOLO: 'Solo consentimiento (sin retiro físico)',
  CANCELADO: 'Cancelado'
};

export const PICKUP_METHOD_LABEL: Record<string, string> = {
  VEHICULO_REGISTRADO: 'Vehículo registrado',
  OTRO_VEHICULO: 'Otro vehículo',
  A_PIE: 'A pie',
  TRANSPORTE_PUBLICO: 'Transporte público',
  SOLO_CONSENTIMIENTO: 'Solo consentimiento'
};

export const TEACHER_SIGNAL_LABEL: Record<string, string> = {
  PREPARA_SALIDA: 'Preparar salida',
  ALUMNO_CAMINO_A_SALIDA: 'Alumno en camino a salida'
};
