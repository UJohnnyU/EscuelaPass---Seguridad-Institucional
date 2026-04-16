/**
 * Caché en memoria por pestaña (vida de la sesión de la SPA). Evita repetir GET
 * idénticos al volver a una vista durante unos segundos.
 */
type Entry = { storedAt: number; payload: unknown };
const store = new Map<string, Entry>();
const DEFAULT_TTL_MS = 45_000;

export function readSessionCache<T>(key: string, ttlMs = DEFAULT_TTL_MS): T | null {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() - e.storedAt > ttlMs) {
    store.delete(key);
    return null;
  }
  return e.payload as T;
}

export function writeSessionCache(key: string, payload: unknown) {
  store.set(key, { storedAt: Date.now(), payload });
}

export function invalidateSessionCachePrefix(prefix: string) {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}
