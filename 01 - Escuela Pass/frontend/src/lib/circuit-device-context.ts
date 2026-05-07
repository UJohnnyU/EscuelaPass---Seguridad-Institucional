import { useSyncExternalStore } from 'react';

/**
 * Indica si el dispositivo parece adecuado para el mapa en vivo del circuito (GPS preciso).
 * En ordenadores típicos (puntero fino, sin UA móvil) devuelve false: se pide continuar en el móvil.
 */
export function isParentCircuitGpsSupportedOnThisDevice(): boolean {
  if (typeof window === 'undefined') return true;

  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  if (coarse) return true;

  const ua = navigator.userAgent ?? '';
  if (/Mobi|Android.*Mobile|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }
  if (/iPad|Tablet/i.test(ua)) return true;
  // iPadOS 13+ a veces se presenta como Mac con táctil
  if (typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1 && /Mac/.test(ua)) {
    return true;
  }
  return false;
}

function subscribeCircuitGpsDevice(callback: () => void): () => void {
  const mq = window.matchMedia?.('(pointer: coarse)');
  mq?.addEventListener?.('change', callback);
  window.addEventListener('resize', callback);
  return () => {
    mq?.removeEventListener?.('change', callback);
    window.removeEventListener('resize', callback);
  };
}

/** Reactivo ante cambios de pointer o ventana (p. ej. emulación en devtools). */
export function useParentCircuitGpsOnDevice(): boolean {
  return useSyncExternalStore(
    subscribeCircuitGpsDevice,
    isParentCircuitGpsSupportedOnThisDevice,
    () => true
  );
}
