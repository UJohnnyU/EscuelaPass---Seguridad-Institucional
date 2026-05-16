#!/usr/bin/env node
/**
 * Punto único TDG: recuento y tabla Markdown de rutas desde controladores NestJS.
 * Regeneración del Anexo 08: ejecutar `npm run tdg:enrich` y contrastar TOTAL (241 esperado).
 */
const { spawnSync } = require('child_process');
const path = require('path');

const cwd = path.join(__dirname, '..');
const extract = path.join(__dirname, 'extract-api-routes.cjs');
const r = spawnSync(process.execPath, [extract], { cwd, encoding: 'utf8', stdio: 'inherit' });
process.exit(r.status ?? 1);
