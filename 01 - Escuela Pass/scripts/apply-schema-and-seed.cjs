/*
Escuela Pass — Proprietary Software License
Copyright (c) 2026 Murillo Martínez Jhon Kevin. All Rights Reserved.

NOTICE: This software and associated documentation files (the "Software")
constitute proprietary intellectual property. Unauthorized use is prohibited.

1. GRANT OF RIGHTS
   No license is granted to any person or entity except as expressly set
   forth in a separate written agreement signed by the copyright holder.

2. RESTRICTIONS
   Without prior written permission from the copyright holder, you may NOT:
   (a) copy, modify, adapt, translate, or create derivative works of the Software;
   (b) reverse engineer, decompile, or disassemble the Software, except as
       permitted by applicable law;
   (c) distribute, sublicense, lease, rent, sell, or otherwise transfer the
       Software or any portion thereof;
   (d) use the Software for commercial purposes, including offering it as a
       hosted service to third parties;
   (e) remove or alter any proprietary notices, labels, or marks.

3. THIRD-PARTY COMPONENTS
   The Software may include or depend on third-party open-source components
   licensed under their own terms (see package manifests and NOTICE files).
   Those components remain governed by their respective licenses. This license
   applies only to the original work of the copyright holder.

4. ACADEMIC REPOSITORY (POLI JIC)
   A non-exclusive, royalty-free, limited license is granted to Politécnico
   Colombiano Jaime Isaza Cadavid solely to archive, reproduce, and make
   available the version of the Software submitted as part of the author's
   degree thesis for academic, educational, and non-commercial public
   consultation purposes, in accordance with institutional publication
   authorization. This does not grant commercial exploitation rights to
   the institution or to third parties.

5. NO WARRANTY
   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL
   THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY.

6. GOVERNING LAW
   This license shall be governed by the laws of the Republic of Colombia,
   without regard to conflict-of-law principles.

7. CONTACT
   For licensing inquiries: jhonkevinmurillom@gmail.com

---

Resumen en español:
Software propietario de Murillo Martínez Jhon Kevin (2026). Queda prohibida la
copia, modificación, distribución o explotación comercial sin autorización
escrita. El POLI JIC cuenta con autorización limitada, no exclusiva y sin
fines de lucro, para archivo y consulta académica de la versión entregada
como Trabajo de Grado. Los componentes de terceros se rigen por sus propias
licencias.
*/

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
