/**
 * Resuelve orígenes CORS: `CORS_ORIGIN`, `FRONTEND_URL` y dominio custom de producción.
 */
export function resolveCorsOrigins(): string[] | string | boolean {
  const origins = new Set<string>();

  const corsRaw = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
  for (const origin of corsRaw.split(',').map((s) => s.trim()).filter(Boolean)) {
    origins.add(origin);
  }

  const frontend = (process.env.FRONTEND_URL ?? '').trim().replace(/\/$/, '');
  if (frontend) {
    origins.add(frontend);
    try {
      const url = new URL(frontend);
      const host = url.hostname;
      if (host.startsWith('www.')) {
        origins.add(`${url.protocol}//${host.slice(4)}`);
      } else {
        origins.add(`${url.protocol}//www.${host}`);
      }
    } catch {
      /* URL inválida en FRONTEND_URL: se ignora la variante www */
    }
  }

  if (process.env.NODE_ENV === 'production') {
    origins.add('https://escuelapass.com');
    origins.add('https://www.escuelapass.com');
  }

  const list = [...origins];
  return list.length <= 1 ? list[0] ?? true : list;
}

/** Base del SPA para enlaces generados en el servidor (correos, etc.). */
export function resolveFrontendBaseUrl(): string {
  const fromEnv = (process.env.FRONTEND_URL ?? '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  if (process.env.NODE_ENV === 'production') {
    return 'https://escuelapass.com';
  }

  const corsFirst = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)[0]
    ?.replace(/\/$/, '');

  return corsFirst || 'http://localhost:5173';
}
