/**
 * Tras el baseline en setup-e2e-db.js, aplica el mismo saneo incremental que
 * main.ts (`ensureRuntimeSchema`) para reducir deriva con nuevas tablas/columnas.
 */
import 'reflect-metadata';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm/data-source';
import { buildTypeOrmConfig } from '../src/config/typeorm.config';
import { ensureRuntimeSchema } from '../src/database/ensure-runtime-schema';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.e2e'), override: true });

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
    process.env.DATABASE_URL = `postgresql://${u}:${p}@${host}:${port}/${d}${qs}`;
    process.env.POSTGRES_URL = process.env.DATABASE_URL;
  }
}

async function main() {
  const config = buildTypeOrmConfig() as DataSourceOptions;
  const ds = new DataSource(config);
  await ds.initialize();
  try {
    await ensureRuntimeSchema(ds);
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[e2e] ensure-runtime-schema-e2e:', err);
  process.exit(1);
});
