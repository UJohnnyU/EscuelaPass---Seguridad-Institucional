import { useEffect, useState } from 'react';

/**
 * Retorna `value` solo después de que pasen `delayMs` ms sin cambios.
 * Util para debounce de inputs y filtros que disparan fetch.
 *
 * Aplicado en: MisCalificacionesPage (filterPeriod).
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
