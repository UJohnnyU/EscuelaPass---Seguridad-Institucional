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
 * Lista métodos HTTP de controladores NestJS (auditoría Anexo 08).
 * Uso: node scripts/extract-api-routes.cjs
 */
const fs = require('fs');
const path = require('path');

function walkControllers(dir, acc = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, name.name);
    if (name.isDirectory()) walkControllers(fp, acc);
    else if (name.name.endsWith('.controller.ts')) acc.push(fp);
  }
  return acc;
}

function combineBaseSub(base, sub) {
  const b = (base || '').replace(/^\/+|\/+$/g, '');
  let s = (sub || '').replace(/^\/+|\/+$/g, '').replace(/^['"]|['"]$/g, '');
  if (!s) return b;
  if (!b) return s;
  return `${b}/${s}`.replace(/\/+/g, '/');
}

const httpDecos = ['Get', 'Post', 'Put', 'Patch', 'Delete', 'Options', 'Head', 'All'];
const decoRe = new RegExp(`@(${httpDecos.join('|')})\\s*\\(`, 'g');

/** Contenido entre paréntesis inmediatos tras @(Get|Post...) */
function parensContents(src, openParenIdx) {
  let depth = 1;
  let i = openParenIdx + 1;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    i++;
  }
  return src.slice(openParenIdx + 1, i - 1);
}

function parseFile(filePath) {
  const rel = path.relative(process.cwd(), filePath).split(path.sep).join('/');
  const src = fs.readFileSync(filePath, 'utf8');

  let base = '';
  const cq = src.match(/@Controller\s*\(\s*(['"])(.*?)\1\s*\)/);
  const cb = src.match(/@Controller\s*\(\s*\)/);
  if (cq) base = cq[2];
  else if (cb) base = '';

  const rows = [];
  let m;
  while ((m = decoRe.exec(src)) !== null) {
    const method = m[1].toUpperCase();
    const openIdx = src.indexOf('(', m.index + m[0].length - 1);
    const inner = parensContents(src, openIdx);
    let subpath = '';
    const str = inner.match(/^\s*(['"])(.*?)\1/);
    if (str) subpath = str[2];
    rows.push({ method, route: combineBaseSub(base, subpath), file: rel });
  }
  return rows;
}

const modulesDir = path.join(process.cwd(), 'src', 'modules');
const files = walkControllers(modulesDir).sort();
const all = files.flatMap(parseFile);
console.log(JSON.stringify({ controllerFiles: files.length, routeRows: all.length }, null, 0));
