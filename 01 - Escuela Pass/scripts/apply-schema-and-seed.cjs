/**
 * Aplica escuela_pass_schema_v3.sql y scripts/database/seed_dev.sql usando DATABASE_URL.
 * Uso (desde la carpeta del backend): node scripts/apply-schema-and-seed.cjs
 * Requiere: postgres directo (postgres:// o postgresql://), no prisma+postgres://
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

function directPostgresUrl() {
  const u = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PRISMA_DATABASE_URL;
  if (!u || u.startsWith('prisma+')) {
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
        'La URL prisma+postgres:// (Accelerate) no sirve para TypeORM ni para este script.'
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
    await runSqlFile(client, 'escuela_pass_schema_v3.sql', { stripCreateExtensions: stripExt });
    await runSqlFile(client, 'scripts/database/seed_dev.sql');
    // eslint-disable-next-line no-console
    console.log('[db] Esquema y seed aplicados.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[db] Error:', err.message || err);
  process.exit(1);
});
