/**
 * Helpers de redaccion de PII para logs. Se usan donde la auditoria es util pero
 * el dato bruto (correo completo, telefono, matricula) NO debe quedar persistido
 * en logs ni metricas (LFPDPPP).
 */

/**
 * Devuelve una version del email apta para logs: `a***@d***.com`.
 * Si la entrada no parece un email, devuelve `***` para evitar fugas.
 */
export function redactEmail(value: string | null | undefined): string {
  if (!value) return '***';
  const trimmed = value.trim();
  if (!trimmed) return '***';
  const at = trimmed.indexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return '***';
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const tld = dot >= 0 && dot < domain.length - 1 ? domain.slice(dot) : '';
  const domainHead = dot > 0 ? domain.slice(0, dot) : domain;
  const localHead = local[0] ?? '';
  const domainHeadStart = domainHead[0] ?? '';
  return `${localHead}***@${domainHeadStart}***${tld}`;
}
