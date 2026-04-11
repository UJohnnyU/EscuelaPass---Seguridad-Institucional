/** Estados en los que el circuito ya no admite señales ni cambios operativos. */
export function isCircuitTerminal(status: string): boolean {
  return (
    status === 'ENTREGADO' ||
    status === 'CANCELADO' ||
    status === 'CERRADO_SIN_CONFIRMACION_PADRE'
  );
}

/** Siguiente señal pedagógica permitida (orden fijo); `null` si ya se enviaron las dos. */
export function getNextPedagogicalSignal(teacherSignal: string | null): 'PREPARA_SALIDA' | 'ALUMNO_CAMINO_A_SALIDA' | null {
  if (teacherSignal == null || teacherSignal === '') return 'PREPARA_SALIDA';
  if (teacherSignal === 'PREPARA_SALIDA') return 'ALUMNO_CAMINO_A_SALIDA';
  if (teacherSignal === 'ALUMNO_CAMINO_A_SALIDA') return null;
  return 'PREPARA_SALIDA';
}
