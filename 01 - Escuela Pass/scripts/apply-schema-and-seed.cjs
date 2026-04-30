/**
 * Aplica esquema completo + seed de demostración usando DATABASE_URL (PostgreSQL directo).
 *
 * Esquema de referencia: escuela_pass_schema_v4.sql  (todas las tablas)
 * Seed completo:         scripts/seed-full-demo.cjs  (ejecutado por separado via node)
 *
 * Este script aplica solo el esquema SQL (DDL idempotente — IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
 * Para re-sembrar datos use: node scripts/seed-full-demo.cjs
 *
 * Uso: npm run db:apply
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

function directPostgresUrl() {
  const u = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!u) {
    return null;
  }
  if (u.startsWith('postgres://') || u.startsWith('postgresql://')) {
    return u;
  }
  return null;
}

/** Sin extensiones uuid-ossp: PG13+ tiene gen_random_uuid() en el núcleo. */
function sqlWithoutExtensionDeps(sql) {
  return sql
    .split(/\r?\n/)
    .filter((line) => !/^CREATE EXTENSION\b/i.test(line.trim()))
    .join('\n')
    .replace(/\buuid_generate_v4\s*\(\s*\)/gi, 'gen_random_uuid()');
}

async function runSqlFile(client, relativeFile, { stripCreateExtensions = false } = {}) {
  const filePath = path.resolve(__dirname, '..', relativeFile);
  let sql = fs.readFileSync(filePath, 'utf8');
  if (stripCreateExtensions) {
    sql = sqlWithoutExtensionDeps(sql);
  }
  await client.query(sql);
  // eslint-disable-next-line no-console
  console.log(`[db] OK ${relativeFile}`);
}

async function main() {
  const url = directPostgresUrl();
  if (!url) {
    // eslint-disable-next-line no-console
    console.error(
      '[db] Define DATABASE_URL con una URL postgres:// o postgresql:// (conexión directa).\n' +
        'No uses prefijos no compatibles; debe ser postgres:// o postgresql://.'
    );
    process.exit(1);
  }

  const client = new Client({
    connectionString: url,
    ssl: url.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined
  });
  await client.connect();
  // Solo si el host no permite CREATE EXTENSION (p. ej. algunos planes): DB_SKIP_EXTENSIONS=1
  const stripExt = process.env.DB_SKIP_EXTENSIONS === '1';
  try {
    // Aplicar esquema completo v4 (idempotente — solo DDL, sin datos)
    await runSqlFile(client, 'escuela_pass_schema_v4.sql', { stripCreateExtensions: stripExt });
    // eslint-disable-next-line no-console
    console.log('[db] Esquema aplicado. Para poblar datos ejecute: node scripts/seed-full-demo.cjs');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[db] Error:', err.message || err);
  process.exit(1);
});
