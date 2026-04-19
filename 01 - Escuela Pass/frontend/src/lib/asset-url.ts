import { API_BASE_URL } from './api';

/** Convierte ruta `/uploads/…` del API en URL absoluta (dev: backend en :3000). */
export function publicAssetUrl(relative: string | null | undefined): string | null {
  if (!relative?.startsWith('/')) return null;
  if (API_BASE_URL) return `${API_BASE_URL}${relative}`;
  /** En dev, Vite proxy sirve `/uploads` desde el API (ver `vite.config.ts`). */
  if (import.meta.env.DEV) return `${typeof window !== 'undefined' ? window.location.origin : ''}${relative}`;
  return `${typeof window !== 'undefined' ? window.location.origin : ''}${relative}`;
}
