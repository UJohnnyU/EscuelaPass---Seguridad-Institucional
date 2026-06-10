#!/usr/bin/env node
/**
 * Smoke test: health del API Railway y preflight CORS desde escuelapass.com.
 * Uso: node scripts/smoke-cors-domain.cjs
 */
const API_BASE =
  process.env.SMOKE_API_BASE?.trim() ||
  'https://escuelapass-seguridad-institucional-production.up.railway.app';
const FRONTEND_ORIGIN =
  process.env.SMOKE_FRONTEND_ORIGIN?.trim() || 'https://escuelapass.com';

async function main() {
  const healthUrl = `${API_BASE.replace(/\/+$/, '')}/api/v1/health`;
  console.log(`GET ${healthUrl}`);
  const healthRes = await fetch(healthUrl);
  const healthBody = await healthRes.text();
  console.log(`  status=${healthRes.status} body=${healthBody.slice(0, 120)}`);
  if (!healthRes.ok) process.exitCode = 1;

  console.log(`OPTIONS ${healthUrl} (Origin: ${FRONTEND_ORIGIN})`);
  const corsRes = await fetch(healthUrl, {
    method: 'OPTIONS',
    headers: {
      Origin: FRONTEND_ORIGIN,
      'Access-Control-Request-Method': 'GET'
    }
  });
  const allowOrigin = corsRes.headers.get('access-control-allow-origin');
  console.log(`  status=${corsRes.status} access-control-allow-origin=${allowOrigin ?? '(missing)'}`);

  if (allowOrigin !== FRONTEND_ORIGIN) {
    console.error(
      `CORS mismatch: expected ${FRONTEND_ORIGIN}, got ${allowOrigin ?? 'none'}. ` +
        'Actualiza CORS_ORIGIN en Railway o despliega el backend con src/lib/cors-origins.ts.'
    );
    process.exitCode = 1;
  } else {
    console.log('CORS OK for escuelapass.com');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
