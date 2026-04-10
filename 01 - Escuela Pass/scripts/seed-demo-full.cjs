/**
 * Ejecuta scripts/database/seed_demo_full.sql (tras schema + seed_dev).
 * Uso: node scripts/seed-demo-full.cjs
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

function directPostgresUrl() {
  const u = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!u) return null;
  if (u.startsWith('postgres://') || u.startsWith('postgresql://')) return u;
  return null;
}

async function main() {
  const url = directPostgresUrl();
  if (!url) {
    console.error('[seed-demo] Define DATABASE_URL (postgres directa).');
    process.exit(1);
  }
  const sql = fs.readFileSync(path.resolve(__dirname, 'database', 'seed_demo_full.sql'), 'utf8');
  const client = new Client({
    connectionString: url,
    ssl: url.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined
  });
  await client.connect();
  try {
    await client.query(sql);
    console.log('[seed-demo] OK seed_demo_full.sql');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('[seed-demo]', e.message || e);
  process.exit(1);
});
