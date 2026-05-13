const path = require('path');
const dotenv = require('dotenv');

// Carga .env (base) y luego .env.e2e (override) para que los E2E
// usen una base de datos separada sin duplicar secretos aquí.
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.e2e'), override: true });

/**
 * Misma convención que `setup-e2e-db.js`: con E2E_USE_DB_HOST=1 se ignora DATABASE_URL
 * del .env (p. ej. Railway para desarrollo) y TypeORM usa una URL derivada de DB_*.
 */
const e2eHost = process.env.E2E_USE_DB_HOST;
if (e2eHost === '1' || e2eHost === 'true' || e2eHost === 'yes') {
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || '5432';
  const user = process.env.DB_USER;
  const pass = process.env.DB_PASS ?? '';
  const db = process.env.DB_NAME;
  if (host && user && db) {
    const u = encodeURIComponent(user);
    const p = encodeURIComponent(pass);
    const d = encodeURIComponent(db);
    const qs =
      process.env.E2E_DB_SSL === '1' || process.env.E2E_DB_SSL === 'true' ? '?sslmode=require' : '';
    const built = `postgresql://${u}:${p}@${host}:${port}/${d}${qs}`;
    process.env.DATABASE_URL = built;
    process.env.POSTGRES_URL = built;
  }
}

/**
 * Throttle por IP en /auth/login (AUTH_THROTTLE_LIMIT / AUTH_THROTTLE_TTL_MS).
 * La suite app.e2e-spec.ts hace decenas de logins; sin ampliar el cupo en E2E
 * se encadena 429. Si ya definiste AUTH_THROTTLE_* en el entorno (p. ej. prueba
 * dedicada de throttle), no lo sobrescribimos.
 */
if (process.env.AUTH_THROTTLE_LIMIT === undefined) {
  process.env.AUTH_THROTTLE_LIMIT = '20000';
}
if (process.env.AUTH_THROTTLE_TTL_MS === undefined) {
  process.env.AUTH_THROTTLE_TTL_MS = '60000';
}

