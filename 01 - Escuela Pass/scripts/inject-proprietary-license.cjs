#!/usr/bin/env node
/**
 * Escuela Pass — Proprietary Software License
 * Copyright (c) 2026 Murillo Martínez Jhon Kevin. All Rights Reserved.
 *
 * NOTICE: This software and associated documentation files (the "Software")
 * constitute proprietary intellectual property. Unauthorized use is prohibited.
 *
 * 1. GRANT OF RIGHTS
 *    No license is granted to any person or entity except as expressly set
 *    forth in a separate written agreement signed by the copyright holder.
 *
 * 2. RESTRICTIONS
 *    Without prior written permission from the copyright holder, you may NOT:
 *    (a) copy, modify, adapt, translate, or create derivative works of the Software;
 *    (b) reverse engineer, decompile, or disassemble the Software, except as
 *        permitted by applicable law;
 *    (c) distribute, sublicense, lease, rent, sell, or otherwise transfer the
 *        Software or any portion thereof;
 *    (d) use the Software for commercial purposes, including offering it as a
 *        hosted service to third parties;
 *    (e) remove or alter any proprietary notices, labels, or marks.
 *
 * 3. THIRD-PARTY COMPONENTS
 *    The Software may include or depend on third-party open-source components
 *    licensed under their own terms (see package manifests and NOTICE files).
 *    Those components remain governed by their respective licenses. This license
 *    applies only to the original work of the copyright holder.
 *
 * 4. ACADEMIC REPOSITORY (POLI JIC)
 *    A non-exclusive, royalty-free, limited license is granted to Politécnico
 *    Colombiano Jaime Isaza Cadavid solely to archive, reproduce, and make
 *    available the version of the Software submitted as part of the author's
 *    degree thesis for academic, educational, and non-commercial public
 *    consultation purposes, in accordance with institutional publication
 *    authorization. This does not grant commercial exploitation rights to
 *    the institution or to third parties.
 *
 * 5. NO WARRANTY
 *    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *    IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
 *    FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL
 *    THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY.
 *
 * 6. GOVERNING LAW
 *    This license shall be governed by the laws of the Republic of Colombia,
 *    without regard to conflict-of-law principles.
 *
 * 7. CONTACT
 *    For licensing inquiries: jhonkevinmurillom@gmail.com
 *
 * ---
 *
 * Resumen en español:
 * Software propietario de Murillo Martínez Jhon Kevin (2026). Queda prohibida la
 * copia, modificación, distribución o explotación comercial sin autorización
 * escrita. El POLI JIC cuenta con autorización limitada, no exclusiva y sin
 * fines de lucro, para archivo y consulta académica de la versión entregada
 * como Trabajo de Grado. Los componentes de terceros se rigen por sus propias
 * licencias.
 *
 * Inyecta el encabezado de licencia en archivos de texto/código bajo el proyecto.
 * Uso: node scripts/inject-proprietary-license.cjs [--dry-run] [--verify]
 */
const fs = require('fs');
const path = require('path');

const MARKER = 'Escuela Pass — Proprietary Software License';

const LICENSE_LINES = [
  'Escuela Pass — Proprietary Software License',
  'Copyright (c) 2026 Murillo Martínez Jhon Kevin. All Rights Reserved.',
  '',
  'NOTICE: This software and associated documentation files (the "Software")',
  'constitute proprietary intellectual property. Unauthorized use is prohibited.',
  '',
  '1. GRANT OF RIGHTS',
  '   No license is granted to any person or entity except as expressly set',
  '   forth in a separate written agreement signed by the copyright holder.',
  '',
  '2. RESTRICTIONS',
  '   Without prior written permission from the copyright holder, you may NOT:',
  '   (a) copy, modify, adapt, translate, or create derivative works of the Software;',
  '   (b) reverse engineer, decompile, or disassemble the Software, except as',
  '       permitted by applicable law;',
  '   (c) distribute, sublicense, lease, rent, sell, or otherwise transfer the',
  '       Software or any portion thereof;',
  '   (d) use the Software for commercial purposes, including offering it as a',
  '       hosted service to third parties;',
  '   (e) remove or alter any proprietary notices, labels, or marks.',
  '',
  '3. THIRD-PARTY COMPONENTS',
  '   The Software may include or depend on third-party open-source components',
  '   licensed under their own terms (see package manifests and NOTICE files).',
  '   Those components remain governed by their respective licenses. This license',
  '   applies only to the original work of the copyright holder.',
  '',
  '4. ACADEMIC REPOSITORY (POLI JIC)',
  '   A non-exclusive, royalty-free, limited license is granted to Politécnico',
  '   Colombiano Jaime Isaza Cadavid solely to archive, reproduce, and make',
  '   available the version of the Software submitted as part of the author\'s',
  '   degree thesis for academic, educational, and non-commercial public',
  '   consultation purposes, in accordance with institutional publication',
  '   authorization. This does not grant commercial exploitation rights to',
  '   the institution or to third parties.',
  '',
  '5. NO WARRANTY',
  '   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR',
  '   IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,',
  '   FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL',
  '   THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY.',
  '',
  '6. GOVERNING LAW',
  '   This license shall be governed by the laws of the Republic of Colombia,',
  '   without regard to conflict-of-law principles.',
  '',
  '7. CONTACT',
  '   For licensing inquiries: jhonkevinmurillom@gmail.com',
  '',
  '---',
  '',
  'Resumen en español:',
  'Software propietario de Murillo Martínez Jhon Kevin (2026). Queda prohibida la',
  'copia, modificación, distribución o explotación comercial sin autorización',
  'escrita. El POLI JIC cuenta con autorización limitada, no exclusiva y sin',
  'fines de lucro, para archivo y consulta académica de la versión entregada',
  'como Trabajo de Grado. Los componentes de terceros se rigen por sus propias',
  'licencias.'
];

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git', '.cursor', '.vercel']);
const SKIP_EXT = new Set(['.json', '.png', '.pdf', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2']);
const BLOCK_EXT = new Set(['.ts', '.tsx', '.js', '.cjs', '.mjs', '.css', '.sql']);
const HTML_EXT = new Set(['.md', '.html', '.svg']);
const HASH_NAMES = new Set([
  '.gitignore',
  '.nvmrc',
  '.prettierrc',
  '.env.example',
  '.gitkeep'
]);

function formatBlock(lines) {
  return `/*\n${lines.join('\n')}\n*/\n\n`;
}

function formatHtml(lines) {
  return `<!--\n${lines.join('\n')}\n-->\n\n`;
}

function formatHash(lines) {
  return `${lines.map((l) => (l ? `# ${l}` : '#')).join('\n')}\n\n`;
}

function resolveFormat(filePath, baseName) {
  const ext = path.extname(filePath).toLowerCase();
  if (BLOCK_EXT.has(ext)) return 'block';
  if (HTML_EXT.has(ext)) return 'html';
  if (ext === '.toml' || ext === '.example') return 'hash';
  if (HASH_NAMES.has(baseName)) return 'hash';
  if (baseName.startsWith('.env')) return 'hash';
  if (baseName === '.eslintrc.cjs' || baseName.endsWith('.cjs')) return 'block';
  return null;
}

function buildHeader(format) {
  if (format === 'block') return formatBlock(LICENSE_LINES);
  if (format === 'html') return formatHtml(LICENSE_LINES);
  if (format === 'hash') return formatHash(LICENSE_LINES);
  return null;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (SKIP_EXT.has(ext)) continue;
    const format = resolveFormat(full, entry.name);
    if (!format) continue;
    out.push({ full, format });
  }
  return out;
}

function insertHeader(content, header) {
  if (content.includes(MARKER)) return null;
  const shebang = content.startsWith('#!') ? content.indexOf('\n') : -1;
  if (shebang >= 0) {
    const first = content.slice(0, shebang + 1);
    const rest = content.slice(shebang + 1).replace(/^\n+/, '');
    return `${first}\n${header}${rest}`;
  }
  return `${header}${content}`;
}

function injectFile(filePath, format, dryRun) {
  const header = buildHeader(format);
  if (!header) return 'skipped';
  const content = fs.readFileSync(filePath, 'utf8');
  const next = insertHeader(content, header);
  if (next === null) return 'already';
  if (!dryRun) fs.writeFileSync(filePath, next, 'utf8');
  return 'modified';
}

function verify(files) {
  const missing = [];
  for (const { full } of files) {
    const content = fs.readFileSync(full, 'utf8');
    if (!content.includes(MARKER)) missing.push(path.relative(ROOT, full));
  }
  return missing;
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const verifyOnly = process.argv.includes('--verify');
  const files = walk(ROOT);

  if (verifyOnly) {
    const missing = verify(files);
    if (missing.length === 0) {
      console.log(`[license] OK: ${files.length} archivos elegibles con marcador.`);
      process.exit(0);
    }
    console.error(`[license] Faltan ${missing.length} archivos:`);
    for (const m of missing) console.error(`  - ${m}`);
    process.exit(1);
  }

  let modified = 0;
  let already = 0;
  for (const { full, format } of files) {
    const rel = path.relative(ROOT, full);
    const result = injectFile(full, format, dryRun);
    if (result === 'modified') {
      modified += 1;
      console.log(`${dryRun ? '[dry-run] ' : ''}modified: ${rel}`);
    } else if (result === 'already') {
      already += 1;
    }
  }

  console.log(
    `[license] ${dryRun ? 'dry-run ' : ''}done: modified=${modified}, already=${already}, eligible=${files.length}`
  );
}

main();
