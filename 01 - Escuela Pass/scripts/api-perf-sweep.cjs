/*
Escuela Pass — Proprietary Software License
Copyright (c) 2026 Murillo Martínez Jhon Kevin. All Rights Reserved.
*/

/**
 * Prueba de rendimiento académica (TDG §5.4): barrido del catálogo REST + carga concurrente GET.
 *
 * Prerrequisitos:
 *   npm run pretest:e2e
 *   npm run build && npm run start:prod
 *   npm run perf:sweep
 *
 * Variables opcionales:
 *   PERF_BASE_URL (default http://127.0.0.1:3000)
 *   API_PREFIX (default api/v1)
 *   PERF_ADMIN_EMAIL / PERF_ADMIN_PASSWORD
 *   PERF_CONCURRENCY (default 10)
 *   PERF_DURATION_SEC (default 30)
 *   RNF4_THRESHOLD_MS (default 2000)
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { extractRoutes } = require('./extract-api-routes.cjs');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.e2e'), override: true });

const PLACEHOLDER_UUID = '00000000-0000-4000-8000-000000000001';
const baseUrl = (process.env.PERF_BASE_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const apiPrefix = (process.env.API_PREFIX || 'api/v1').replace(/^\/+|\/+$/g, '');
const adminEmail = process.env.PERF_ADMIN_EMAIL || 'admin@escuelapass.local';
const adminPassword = process.env.PERF_ADMIN_PASSWORD || 'Admin123*';
const concurrency = Math.max(1, Number(process.env.PERF_CONCURRENCY || 10));
const durationSec = Math.max(5, Number(process.env.PERF_DURATION_SEC || 30));
const rnf4Ms = Math.max(100, Number(process.env.RNF4_THRESHOLD_MS || 2000));

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function resolveRoute(template, ctx) {
  return template.replace(/:([A-Za-z0-9_]+)/g, (_, key) => {
    const variants = [
      key,
      key.charAt(0).toLowerCase() + key.slice(1),
      key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, ''),
      key.replace(/Id$/i, 'Id').toLowerCase()
    ];
    for (const v of variants) {
      if (ctx[v]) return String(ctx[v]);
    }
    return ctx.id || PLACEHOLDER_UUID;
  });
}

async function timedFetch(url, options = {}) {
  const start = performance.now();
  try {
    const res = await fetch(url, { ...options, signal: AbortSignal.timeout(30_000) });
    const ms = performance.now() - start;
    return { ok: true, status: res.status, ms };
  } catch (err) {
    const ms = performance.now() - start;
    return { ok: false, status: 0, ms, error: err.message || String(err) };
  }
}

async function login() {
  const url = `${baseUrl}/${apiPrefix}/auth/login`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Login falló (${res.status}): ${text.slice(0, 200)}`);
  }
  const body = await res.json();
  return { token: body.accessToken, userId: body.user?.id };
}

async function bootstrapContext(token) {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const ctx = { id: PLACEHOLDER_UUID };

  async function getJson(route) {
    const res = await fetch(`${baseUrl}/${apiPrefix}/${route}`, { headers });
    if (!res.ok) return null;
    return res.json();
  }

  const [schools, students, teachers, parents, groups, subjects, periods, credentials] = await Promise.all([
    getJson('schools'),
    getJson('school/students'),
    getJson('school/teachers'),
    getJson('school/parents'),
    getJson('school/groups'),
    getJson('school/subjects'),
    getJson('academic-periods'),
    getJson('access-events/credentials')
  ]);

  const school = Array.isArray(schools) ? schools[0] : null;
  const student = Array.isArray(students) ? students[0] : null;
  const teacher = Array.isArray(teachers) ? teachers[0] : null;
  const parent = Array.isArray(parents) ? parents[0] : null;
  const group = Array.isArray(groups) ? groups[0] : null;
  const subject = Array.isArray(subjects) ? subjects[0] : null;
  const period = Array.isArray(periods) ? periods[0] : null;
  const credential = Array.isArray(credentials) ? credentials[0] : null;

  if (school?.id) ctx.schoolId = school.id;
  if (student?.id) {
    ctx.studentId = student.id;
    ctx.id = student.id;
  }
  if (student?.userId) ctx.userId = student.userId;
  if (teacher?.id) ctx.teacherId = teacher.id;
  if (parent?.id) ctx.parentId = parent.id;
  if (group?.id) ctx.groupId = group.id;
  if (subject?.id) ctx.subjectId = subject.id;
  if (period?.id) {
    ctx.periodId = period.id;
    ctx.academicPeriodId = period.id;
  }
  if (credential?.id) ctx.credentialId = credential.id;

  return ctx;
}

function needsAuth(route, method) {
  if (method === 'POST' && route === 'auth/login') return false;
  if (method === 'POST' && route.startsWith('auth/')) return false;
  if (method === 'GET' && route === 'health') return false;
  return true;
}

async function probeRoute(entry, token, ctx) {
  const resolved = resolveRoute(entry.route, ctx);
  const url = `${baseUrl}/${apiPrefix}/${resolved}`;
  const headers = { Accept: 'application/json' };
  if (needsAuth(entry.route, entry.method) && token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (['POST', 'PUT', 'PATCH'].includes(entry.method)) {
    headers['Content-Type'] = 'application/json';
  }

  const options = { method: entry.method, headers };
  if (['POST', 'PUT', 'PATCH'].includes(entry.method)) {
    options.body = '{}';
  }

  const result = await timedFetch(url, options);
  return {
    method: entry.method,
    route: entry.route,
    resolved,
    ...result
  };
}

async function phase1Sweep(routes, token, ctx) {
  const results = [];
  for (const entry of routes) {
    if (entry.method === 'DELETE') {
      results.push({
        method: entry.method,
        route: entry.route,
        resolved: resolveRoute(entry.route, ctx),
        ok: false,
        status: 0,
        ms: 0,
        skipped: true,
        reason: 'DELETE omitido para preservar semilla E2E'
      });
      continue;
    }
    results.push(await probeRoute(entry, token, ctx));
  }
  return results;
}

async function phase2Load(getTargets, token) {
  if (!getTargets.length) {
    return { requests: 0, errors: 0, throughputRps: 0, p50Ms: null, p95Ms: null, maxMs: null, underRnf4Pct: null };
  }

  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const latencies = [];
  let requests = 0;
  let errors = 0;
  const endAt = Date.now() + durationSec * 1000;
  let idx = 0;

  async function worker() {
    while (Date.now() < endAt) {
      const target = getTargets[idx % getTargets.length];
      idx += 1;
      const url = `${baseUrl}/${apiPrefix}/${target.resolved}`;
      const r = await timedFetch(url, { method: 'GET', headers });
      requests += 1;
      if (!r.ok || r.status < 200 || r.status >= 300) errors += 1;
      else latencies.push(r.ms);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  latencies.sort((a, b) => a - b);
  const under = latencies.filter((ms) => ms <= rnf4Ms).length;
  return {
    requests,
    errors,
    concurrency,
    durationSec,
    throughputRps: Number((requests / durationSec).toFixed(2)),
    p50Ms: percentile(latencies, 50),
    p95Ms: percentile(latencies, 95),
    maxMs: latencies.length ? latencies[latencies.length - 1] : null,
    underRnf4Pct: latencies.length ? Number(((under / latencies.length) * 100).toFixed(1)) : null,
    rnf4ThresholdMs: rnf4Ms
  };
}

function summarizePhase1(results) {
  const reached = results.filter((r) => !r.skipped && r.ok);
  const statusBuckets = {};
  for (const r of results) {
    if (r.skipped) continue;
    const key = r.ok ? String(r.status) : r.ok === false && r.status === 0 ? 'ERR' : String(r.status);
    statusBuckets[key] = (statusBuckets[key] || 0) + 1;
  }
  const get2xx = results.filter((r) => r.method === 'GET' && r.ok && r.status >= 200 && r.status < 300);
  const get2xxMs = get2xx.map((r) => r.ms).sort((a, b) => a - b);
  return {
    catalogTotal: results.length,
    probed: results.filter((r) => !r.skipped).length,
    skippedDelete: results.filter((r) => r.skipped).length,
    reached: reached.length,
    statusBuckets,
    get2xxCount: get2xx.length,
    get2xxP50Ms: percentile(get2xxMs, 50),
    get2xxP95Ms: percentile(get2xxMs, 95),
    get2xxMaxMs: get2xxMs.length ? get2xxMs[get2xxMs.length - 1] : null
  };
}

async function main() {
  const { routeRows, routes } = extractRoutes(path.resolve(__dirname, '..'));
  if (routeRows !== 241) {
    console.warn(`Advertencia: catálogo=${routeRows} (esperado 241). Continuando.`);
  }

  const health = await timedFetch(`${baseUrl}/${apiPrefix}/health`);
  if (!health.ok) {
    throw new Error(
      `Servicio no alcanzable en ${baseUrl}/${apiPrefix}/health — levante el backend (npm run start:prod) tras npm run pretest:e2e`
    );
  }

  const { token } = await login();
  const ctx = await bootstrapContext(token);

  console.log(`Fase 1: sondeo secuencial de ${routes.length} operaciones…`);
  const phase1Results = await phase1Sweep(routes, token, ctx);
  const phase1Summary = summarizePhase1(phase1Results);
  const getTargets = phase1Results.filter(
    (r) => r.method === 'GET' && r.ok && r.status >= 200 && r.status < 300 && !r.skipped
  );

  console.log(`Fase 2: carga concurrente (${concurrency} workers, ${durationSec}s) sobre ${getTargets.length} GET 2xx…`);
  const phase2Summary = await phase2Load(getTargets, token);

  const report = {
    generatedAt: new Date().toISOString(),
    environment: {
      baseUrl,
      apiPrefix,
      nodeVersion: process.version,
      databaseNote: 'PostgreSQL 16 con semilla E2E (test/setup-e2e-db.js)'
    },
    catalog: { routeRows, controllerRoutes: routes.length },
    phase1: { summary: phase1Summary, samples: phase1Results },
    phase2: phase2Summary
  };

  const outDir = path.join(__dirname, 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'api-perf-report.json');
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

  console.log('\n--- Resumen ---');
  console.log(`Catálogo: ${routeRows} rutas | Sondeadas: ${phase1Summary.probed} | DELETE omitidos: ${phase1Summary.skippedDelete}`);
  console.log(`Alcanzadas (HTTP): ${phase1Summary.reached}/${phase1Summary.probed}`);
  console.log(`GET 2xx (Fase 1): ${phase1Summary.get2xxCount} — p50=${phase1Summary.get2xxP50Ms}ms p95=${phase1Summary.get2xxP95Ms}ms`);
  console.log(
    `Carga GET (Fase 2): ${phase2Summary.requests} req — p95=${phase2Summary.p95Ms}ms — bajo ${rnf4Ms}ms: ${phase2Summary.underRnf4Pct}%`
  );
  console.log(`Reporte: ${outFile}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
