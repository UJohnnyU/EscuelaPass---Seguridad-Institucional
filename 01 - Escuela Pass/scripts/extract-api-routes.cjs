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
