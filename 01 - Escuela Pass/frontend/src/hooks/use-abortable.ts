import { useCallback, useEffect, useRef } from 'react';

/**
 * Proporciona una AbortSignal con cleanup automático:
 * - Al desmontar el componente la señal se cancela automáticamente.
 * - `abort()` cancela la señal actual e instancia un nuevo controller.
 * - `signal` es un getter que siempre devuelve la señal del controller vigente.
 *
 * Aplicado en: MisCalificacionesPage (cambio de filtros con fetch).
 *
 * Uso típico en useEffect:
 *   const { signal, abort } = useAbortable();
 *   useEffect(() => {
 *     abort();
 *     api.get('/endpoint', { signal }).then(...);
 *   }, [dep]);
 */
export function useAbortable(): { readonly signal: AbortSignal; abort: () => void } {
  const ctrlRef = useRef<AbortController>(new AbortController());

  useEffect(() => {
    ctrlRef.current = new AbortController();
    return () => {
      ctrlRef.current.abort();
    };
  }, []);

  const abort = useCallback(() => {
    ctrlRef.current.abort();
    ctrlRef.current = new AbortController();
  }, []);

  return {
    get signal() {
      return ctrlRef.current.signal;
    },
    abort,
  };
}
