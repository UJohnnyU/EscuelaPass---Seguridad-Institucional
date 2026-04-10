const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.e2e'), override: true });

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

/** URL postgres:// directa. Respeta .env.e2e si override. */
function directPostgresUrl() {
  const u = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!u) return null;
  if (u.startsWith('postgres://') || u.startsWith('postgresql://')) return u;
  return null;
}

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
  console.log(`[e2e-db] OK ${relativeFile}`);
}

async function main() {
  const url = directPostgresUrl();
  const ssl = url && url.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined;

  const client = url
    ? new Client({ connectionString: url, ssl })
    : new Client({
        host: required('DB_HOST'),
        port: Number(process.env.DB_PORT ?? 5432),
        user: required('DB_USER'),
        password: required('DB_PASS'),
        database: required('DB_NAME')
      });

  const dbLabel = url ? '(DATABASE_URL)' : required('DB_NAME');
  try {
    await client.connect();
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    if (msg.includes('does not exist') || msg.includes('no existe')) {
      throw new Error(
        `La base de datos no existe o no tienes acceso (${dbLabel}).\n` +
          (url ? 'Comprueba DATABASE_URL.' : `Crea la BD en pgAdmin y permisos para el usuario.`)
      );
    }
    throw err;
  }

  const stripExtensions =
    process.env.E2E_SKIP_EXTENSIONS === '1' || process.env.E2E_STRIP_EXTENSIONS === '1';

  try {
    // Inicializa esquema y seed en BD de pruebas.
    // Nota: el esquema requiere uuid-ossp y pgcrypto. Si tu usuario no puede crear extensiones,
    // créalas una vez como superusuario en esta BD (o E2E_SKIP_EXTENSIONS=1 en hosts gestionados).
    await runSqlFile(client, 'escuela_pass_schema_v3.sql', { stripCreateExtensions: stripExtensions });
    await runSqlFile(client, 'scripts/database/seed_dev.sql');
    // Asegura valor de enum por si el esquema antiguo ya tenía circuit_status sin PADRE_EN_CAMINO.
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'circuit_status')
           AND NOT EXISTS (
             SELECT 1 FROM pg_enum e
             JOIN pg_type t ON e.enumtypid = t.oid
             WHERE t.typname = 'circuit_status' AND e.enumlabel = 'PADRE_EN_CAMINO'
           ) THEN
          ALTER TYPE circuit_status ADD VALUE 'PADRE_EN_CAMINO';
        END IF;
      END $$;
    `);
    // eslint-disable-next-line no-console
    console.log('[e2e-db] OK circuit_status.PADRE_EN_CAMINO');
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'circuit_status')
           AND NOT EXISTS (
             SELECT 1 FROM pg_enum e
             JOIN pg_type t ON e.enumtypid = t.oid
             WHERE t.typname = 'circuit_status' AND e.enumlabel = 'CERRADO_SIN_CONFIRMACION_PADRE'
           ) THEN
          ALTER TYPE circuit_status ADD VALUE 'CERRADO_SIN_CONFIRMACION_PADRE';
        END IF;
      END $$;
    `);
    await client.query(`
      ALTER TABLE circuit_requests
      ADD COLUMN IF NOT EXISTS parent_confirm_deadline_at TIMESTAMPTZ NULL,
      ADD COLUMN IF NOT EXISTS parent_receipt_confirmed_at TIMESTAMPTZ NULL;
    `);
    // eslint-disable-next-line no-console
    console.log('[e2e-db] OK circuit_status.CERRADO_SIN_CONFIRMACION_PADRE + columnas padre');
    // Evita datos de corridas E2E anteriores (días sin clases / asistencias con "hoy").
    await client.query(`
      TRUNCATE TABLE attendance_records RESTART IDENTITY CASCADE;
      TRUNCATE TABLE school_non_instructional_days RESTART IDENTITY CASCADE;
    `);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[e2e-db] Error:', err);
  process.exit(1);
});

