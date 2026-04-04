/** Estados en los que el circuito ya no admite señales ni cambios operativos. */
export function isCircuitTerminal(status: string): boolean {
  return (
    status === 'ENTREGADO' ||
    status === 'CANCELADO' ||
    status === 'CERRADO_SIN_CONFIRMACION_PADRE'
  );
}
