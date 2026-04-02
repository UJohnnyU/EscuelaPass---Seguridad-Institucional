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

async function runSqlFile(client, relativeFile, { stripCreateExtensions = false } = {}) {
  const filePath = path.resolve(__dirname, '..', relativeFile);
  let sql = fs.readFileSync(filePath, 'utf8');
  if (stripCreateExtensions) {
    sql = sql
      .split(/\r?\n/)
      .filter((line) => !/^CREATE EXTENSION\b/i.test(line.trim()))
      .join('\n');
  }
  await client.query(sql);
  // eslint-disable-next-line no-console
  console.log(`[e2e-db] OK ${relativeFile}`);
}

async function main() {
  const host = required('DB_HOST');
  const port = Number(process.env.DB_PORT ?? 5432);
  const user = required('DB_USER');
  const password = required('DB_PASS');
  const dbName = required('DB_NAME');

  const client = new Client({ host, port, user, password, database: dbName });
  try {
    await client.connect();
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    if (msg.includes('does not exist') || msg.includes('no existe')) {
      throw new Error(
        `La base de datos "${dbName}" no existe o no tienes acceso.\n` +
          `Crea la BD en pgAdmin (una vez) y otorga permisos a "${user}".`
      );
    }
    throw err;
  }
  try {
    // Inicializa esquema y seed en BD de pruebas.
    // Nota: el esquema requiere uuid-ossp y pgcrypto. Si tu usuario no puede crear extensiones,
    // créalas una vez como superusuario en esta BD.
    await runSqlFile(client, 'escuela_pass_schema_v3.sql');
    await runSqlFile(client, 'scripts/database/seed_dev.sql');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[e2e-db] Error:', err);
  process.exit(1);
});

