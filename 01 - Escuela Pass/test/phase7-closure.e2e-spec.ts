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

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import PDFDocument from 'pdfkit';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/** PDF mínimo pero válido (los stubs tipo "%PDF…%%EOF" no abren en visores ni pasan validación). */
async function writeMinimalValidPdf(absPath: string): Promise<void> {
  const buf = await new Promise<Buffer>((resolvePromise, reject) => {
    const doc = new PDFDocument({ size: [120, 80], margin: 12 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolvePromise(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fontSize(9).text('E2E evidencia', { align: 'left' });
    doc.end();
  });
  writeFileSync(absPath, buf);
}

/** Si `E2E_KEEP_UPLOAD_FIXTURES=1` (o `true` / `yes`), no se borran PDFs creados en esta suite. */
function removeE2eUploadFixture(absPath: string): void {
  const keep = ['1', 'true', 'yes'].includes(
    String(process.env.E2E_KEEP_UPLOAD_FIXTURES ?? '').trim().toLowerCase()
  );
  if (keep) return;
  try {
    if (existsSync(absPath)) unlinkSync(absPath);
  } catch {
    /* ignore */
  }
}

// En jest-e2e.setup.js el límite AUTH_THROTTLE por IP suele ser alto (20k/min)
// para que decenas de logins no devuelvan 429. El caso estricto de throttle
// vive en `test/auth-throttle-ip.e2e-spec.ts` (ver `npm run test:e2e:auth-throttle-ip`).
jest.setTimeout(120000);

/**
 * Suite e2e de cierre (Fase 7): cruzes entre Fase 1 (seguridad),
 * Fase 2 (LFPDPPP + audit), Fase 3 (files privados), Fase 4 (performance),
 * Fase 5 (UX) y Fase 6 (lógica institucional).
 *
 * Esta suite asume que app.e2e-spec.ts ya corrió (orden alfabético) y puede
 * haber dejado estado intermedio (lifecycle a BAJA, periodos cerrados, etc.).
 * El beforeAll restaura los datos sembrados a un estado conocido.
 */
describe('Phase 7 — cierre QA cruzado (e2e)', () => {
  let app: INestApplication;
  let db: Pool;

  const apiPrefix = process.env.API_PREFIX ?? 'api/v1';

  type LoginResp = {
    accessToken: string;
    refreshToken: string;
    user: { id: string; role: string };
  };

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  // Retry si alguna petición ve 429 (poco frecuente con cupo alto en E2E).
  const login = async (
    email: string,
    password: string,
    { tries = 6, waitMs = 12_000 } = {}
  ): Promise<LoginResp | null> => {
    for (let i = 0; i < tries; i++) {
      const res = await request(app.getHttpServer())
        .post(`/${apiPrefix}/auth/login`)
        .send({ email, password });
      if (res.status === 201) return res.body as LoginResp;
      if (res.status !== 429) return null;
      await sleep(waitMs);
    }
    return null;
  };

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  // Tokens cacheados para no repetir login en cada caso.
  const tokens: Record<string, string | undefined> = {};
  const tokenFor = async (
    email: string,
    password: string
  ): Promise<string | undefined> => {
    if (tokens[email]) return tokens[email];
    const r = await login(email, password);
    if (r?.accessToken) tokens[email] = r.accessToken;
    return tokens[email];
  };

  const todayIso = (): string => {
    const tz = process.env.APP_TIMEZONE?.trim() || 'America/Mexico_City';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value ?? '';
    const m = parts.find((p) => p.type === 'month')?.value ?? '';
    const d = parts.find((p) => p.type === 'day')?.value ?? '';
    return `${y}-${m}-${d}`;
  };

  type StudentRow = {
    id: string;
    user_id: string;
    school_id: string | null;
    group_id: string | null;
  };

  const findStudent = async (email: string): Promise<StudentRow> => {
    const r = await db.query<StudentRow>(
      `SELECT s.id, s.user_id, s.school_id, s.group_id
       FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE u.email = $1`,
      [email]
    );
    if (!r.rows[0]) throw new Error(`Sin estudiante para ${email}`);
    return r.rows[0];
  };

  const findParent = async (email: string): Promise<{ id: string; user_id: string }> => {
    const r = await db.query<{ id: string; user_id: string }>(
      `SELECT p.id, p.user_id
       FROM parents p
       JOIN users u ON u.id = p.user_id
       WHERE u.email = $1`,
      [email]
    );
    if (!r.rows[0]) throw new Error(`Sin padre para ${email}`);
    return r.rows[0];
  };

  const findTeacherIdByEmail = async (email: string): Promise<string> => {
    const r = await db.query<{ id: string }>(
      `SELECT t.id FROM teachers t
       JOIN users u ON u.id = t.user_id
       WHERE u.email = $1`,
      [email]
    );
    if (!r.rows[0]) throw new Error(`Sin docente para ${email}`);
    return r.rows[0].id;
  };

  const cancelOpenCircuits = async (studentId: string): Promise<void> => {
    await db.query(
      `UPDATE circuit_requests
       SET status = 'CANCELADO'::circuit_status,
           teacher_signal = NULL,
           parent_confirm_deadline_at = NULL,
           parent_confirm_deadline_started_at = NULL
       WHERE student_id = $1
         AND status::text IN ('PENDIENTE','PADRE_EN_CAMINO','NOTIFICADO_LLEGADA','AUTORIZADO_SALIR','EN_CAMINO')`,
      [studentId]
    );
  };

  const ensurePresenceForToday = async (adminToken: string, studentId: string): Promise<void> => {
    const today = todayIso();
    // Quitar non-instructional days que pudieran bloquear
    await db.query(
      `DELETE FROM school_non_instructional_days
       WHERE exception_date = $1::date`,
      [today]
    );
    await request(app.getHttpServer())
      .post(`/${apiPrefix}/attendance/register`)
      .set(auth(adminToken))
      .send({
        studentId,
        status: 'PRESENTE',
        attendanceDate: today,
        notes: 'phase7-presencia'
      });
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(apiPrefix);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true
      })
    );
    await app.init();

    db = new Pool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 5432),
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      ssl:
        (process.env.DB_SSL ?? 'false') === 'true' ? { rejectUnauthorized: false } : undefined
    });

    // Restaurar estado de seed que app.e2e-spec.ts puede haber alterado:
    // - status=true en cuentas seed (lifecycle BAJA setea status=false)
    // - lifecycle ACTIVO en alumno/docente
    // - grupo de alumno1 vuelto a 1A
    // - access_credentials reactivadas
    // - circuit_enabled=true en la escuela principal
    // - cualquier circuito abierto se cancela
    // - periodos académicos vuelven a ACTIVE para no contaminar tests
    // - eliminar boletines publicados generados por otros tests
    await db.query(
      `UPDATE users SET status = true, can_access_campus = true
       WHERE email IN (
         'admin@escuelapass.local',
         'administrativo@escuelapass.local',
         'docente1@escuelapass.local',
         'padre1@escuelapass.local',
         'alumno1@escuelapass.local'
       )`
    );
    await db.query(`UPDATE students SET lifecycle_status = 'ACTIVO'`);
    await db.query(`UPDATE teachers SET lifecycle_status = 'ACTIVO'`);
    await db.query(
      `UPDATE students s
       SET group_id = g.id
       FROM groups g, users u
       WHERE s.user_id = u.id
         AND u.email = 'alumno1@escuelapass.local'
         AND g.name = '1A'
         AND g.school_year = '2026-2027'`
    );
    await db.query(
      `UPDATE access_credentials SET status = 'ACTIVE'
       WHERE user_id IN (
         SELECT id FROM users WHERE email IN (
           'alumno1@escuelapass.local','docente1@escuelapass.local'
         )
       )`
    );
    await db.query(`UPDATE schools SET circuit_enabled = true`);
    await db.query(
      `UPDATE circuit_requests
       SET status = 'CANCELADO'::circuit_status,
           teacher_signal = NULL,
           parent_confirm_deadline_at = NULL,
           parent_confirm_deadline_started_at = NULL
       WHERE status::text IN ('PENDIENTE','PADRE_EN_CAMINO','NOTIFICADO_LLEGADA','AUTORIZADO_SALIR','EN_CAMINO')`
    );
    await db.query(
      `UPDATE academic_periods SET status = 'ACTIVE', closed_at = NULL, closed_by = NULL`
    );
    await db.query(`DELETE FROM report_cards`);

    // Precargamos tokens de cuentas seed para evitar dependencia del throttle
    // en cada test (5/60s por IP). Si alguno falla aquí, la suite reintentará
    // y los tests dependientes podrán saltarse con expect.toBeTruthy guards.
    await tokenFor('admin@escuelapass.local', 'Admin123*');
    await sleep(2000);
    await tokenFor('administrativo@escuelapass.local', 'Admin123*');
    await sleep(2000);
    await tokenFor('docente1@escuelapass.local', 'Docente123*');
    await sleep(2000);
    await tokenFor('padre1@escuelapass.local', 'Padre123*');
  }, 120_000);

  afterAll(async () => {
    if (db) await db.end();
    if (app) await app.close();
  });

  it('Circuito: padre crea solicitud y un segundo intento el mismo día devuelve 400', async () => {
    const adminTok = await tokenFor('admin@escuelapass.local', 'Admin123*');
    const padreTok = await tokenFor('padre1@escuelapass.local', 'Padre123*');
    expect(adminTok).toBeTruthy();
    expect(padreTok).toBeTruthy();
    const student = await findStudent('alumno1@escuelapass.local');
    const parent = await findParent('padre1@escuelapass.local');

    await cancelOpenCircuits(student.id);
    await ensurePresenceForToday(adminTok!, student.id);

    const first = await request(app.getHttpServer())
      .post(`/${apiPrefix}/circuit-requests`)
      .set(auth(padreTok!))
      .send({ studentId: student.id, requestedByParentId: parent.id, pickupMethod: 'A_PIE' })
      .expect(201);
    expect(first.body.requestId).toBeDefined();

    await request(app.getHttpServer())
      .post(`/${apiPrefix}/circuit-requests`)
      .set(auth(padreTok!))
      .send({ studentId: student.id, requestedByParentId: parent.id, pickupMethod: 'A_PIE' })
      .expect(400);

    await cancelOpenCircuits(student.id);
  });

  it('Circuito deshabilitado cancela solicitudes abiertas y bloquea creación de nuevas', async () => {
    const adminTok = await tokenFor('admin@escuelapass.local', 'Admin123*');
    const administrativoTok = await tokenFor('administrativo@escuelapass.local', 'Admin123*');
    const padreTok = await tokenFor('padre1@escuelapass.local', 'Padre123*');
    expect(adminTok).toBeTruthy();
    expect(administrativoTok).toBeTruthy();
    expect(padreTok).toBeTruthy();
    const student = await findStudent('alumno1@escuelapass.local');
    const parent = await findParent('padre1@escuelapass.local');
    expect(student.school_id).toBeTruthy();

    await db.query(`UPDATE schools SET circuit_enabled = true WHERE id = $1`, [student.school_id]);
    await cancelOpenCircuits(student.id);
    await ensurePresenceForToday(adminTok!, student.id);

    const created = await request(app.getHttpServer())
      .post(`/${apiPrefix}/circuit-requests`)
      .set(auth(padreTok!))
      .send({ studentId: student.id, requestedByParentId: parent.id, pickupMethod: 'A_PIE' })
      .expect(201);
    const requestId = created.body.requestId as string;

    await request(app.getHttpServer())
      .patch(`/${apiPrefix}/settings/circuit`)
      .set(auth(administrativoTok!))
      .send({ enabled: false })
      .expect(200);

    const after = await db.query<{ status: string }>(
      `SELECT status::text AS status FROM circuit_requests WHERE id = $1`,
      [requestId]
    );
    expect(after.rows[0]?.status).toBe('CANCELADO');

    const schoolRow = await db.query<{ circuit_enabled: boolean }>(
      `SELECT circuit_enabled FROM schools WHERE id = $1`,
      [student.school_id!]
    );
    expect(schoolRow.rows[0]?.circuit_enabled).toBe(false);

    const second = await request(app.getHttpServer())
      .post(`/${apiPrefix}/circuit-requests`)
      .set(auth(padreTok!))
      .send({ studentId: student.id, requestedByParentId: parent.id, pickupMethod: 'A_PIE' });
    expect([400, 403]).toContain(second.status);

    await db.query(`UPDATE schools SET circuit_enabled = true WHERE id = $1`, [
      student.school_id
    ]);
  });

  it('Asistencia en periodo cerrado: docente sin acceso 403; ADMIN con force=true registra + audita', async () => {
    const adminTok = await tokenFor('admin@escuelapass.local', 'Admin123*');
    const docenteTok = await tokenFor('docente1@escuelapass.local', 'Docente123*');
    expect(adminTok).toBeTruthy();
    expect(docenteTok).toBeTruthy();
    const student = await findStudent('alumno1@escuelapass.local');

    // Aseguramos un periodo que cubra hoy
    const today = todayIso();
    const year = today.slice(0, 4);
    await db.query(
      `INSERT INTO academic_periods (school_id, school_year, name, order_index, start_date, end_date, weight, status)
       SELECT $1, $2, 'E2E7-PERIODO', 99, $3::date, $4::date, 0.00, 'ACTIVE'
       WHERE NOT EXISTS (
         SELECT 1 FROM academic_periods WHERE school_id = $1 AND name = 'E2E7-PERIODO'
       )`,
      [student.school_id, `${year}-${Number(year) + 1}`, `${year}-01-01`, `${year}-12-31`]
    );

    const periodRows = await db.query<{ id: string }>(
      `SELECT id FROM academic_periods
       WHERE school_id = $1
         AND start_date <= $2::date
         AND end_date >= $2::date
       ORDER BY order_index ASC
       LIMIT 1`,
      [student.school_id, today]
    );
    const period = periodRows.rows[0];
    expect(period?.id).toBeDefined();

    // Cerrar periodo manualmente (sin pasar por API, que tiene efectos colaterales)
    await db.query(`UPDATE academic_periods SET status = 'CLOSED', closed_at = NOW() WHERE id = $1`, [
      period.id
    ]);

    try {
      // Docente: 403 (sea por periodo cerrado o por restricciones de asignación)
      const docRes = await request(app.getHttpServer())
        .post(`/${apiPrefix}/attendance/register`)
        .set(auth(docenteTok!))
        .send({ studentId: student.id, status: 'PRESENTE', attendanceDate: today });
      expect([403]).toContain(docRes.status);

      // ADMIN con force=true → 200/201 + nuevo audit row
      const before = await db.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c
         FROM audit_logs WHERE action = 'attendance.force_closed_period'`
      );
      const res = await request(app.getHttpServer())
        .post(`/${apiPrefix}/attendance/register`)
        .set(auth(adminTok!))
        .send({
          studentId: student.id,
          status: 'PRESENTE',
          attendanceDate: today,
          force: true,
          notes: 'phase7-force'
        });
      expect([200, 201]).toContain(res.status);
      const after = await db.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c
         FROM audit_logs WHERE action = 'attendance.force_closed_period'`
      );
      expect(Number(after.rows[0].c)).toBeGreaterThan(Number(before.rows[0].c));
    } finally {
      await db.query(`UPDATE academic_periods SET status = 'ACTIVE', closed_at = NULL WHERE id = $1`, [
        period.id
      ]);
    }
  });

  it('Doble escaneo: segundo scan en <10s devuelve duplicate=true; tras la ventana se admite un nuevo evento', async () => {
    const adminTok = await tokenFor('admin@escuelapass.local', 'Admin123*');
    expect(adminTok).toBeTruthy();
    const student = await findStudent('alumno1@escuelapass.local');
    const today = todayIso();

    await db.query(
      `DELETE FROM attendance_records WHERE student_id = $1 AND attendance_date = $2::date`,
      [student.id, today]
    );
    await db.query(
      `DELETE FROM access_events WHERE user_id = $1 AND event_date = $2::date`,
      [student.user_id, today]
    );

    const first = await request(app.getHttpServer())
      .post(`/${apiPrefix}/access-events/scan`)
      .set(auth(adminTok!))
      .send({ method: 'QR', credentialValue: 'QR_ALUMNO_0001', eventType: 'ENTRY' })
      .expect(201);
    expect(first.body.duplicate).not.toBe(true);

    const dup = await request(app.getHttpServer())
      .post(`/${apiPrefix}/access-events/scan`)
      .set(auth(adminTok!))
      .send({ method: 'QR', credentialValue: 'QR_ALUMNO_0001', eventType: 'EXIT' })
      .expect(201);
    expect(dup.body.duplicate).toBe(true);
    expect(dup.body.originalEvent).toBeDefined();

    // Empujamos el primer evento >10s atrás para que el segundo intento (EXIT) ya no se considere duplicado.
    await db.query(
      `UPDATE access_events SET event_time = NOW() - INTERVAL '20 seconds'
       WHERE user_id = $1 AND event_date = $2::date`,
      [student.user_id, today]
    );

    const third = await request(app.getHttpServer())
      .post(`/${apiPrefix}/access-events/scan`)
      .set(auth(adminTok!))
      .send({ method: 'QR', credentialValue: 'QR_ALUMNO_0001', eventType: 'EXIT' })
      .expect(201);
    expect(third.body.duplicate).not.toBe(true);
  });

  it('Comprobantes pagos: 3 rechazos consecutivos bloquean el cuarto intento de carga', async () => {
    const adminTok = await tokenFor('administrativo@escuelapass.local', 'Admin123*');
    const padreTok = await tokenFor('padre1@escuelapass.local', 'Padre123*');
    expect(adminTok).toBeTruthy();
    expect(padreTok).toBeTruthy();
    const student = await findStudent('alumno1@escuelapass.local');

    await request(app.getHttpServer())
      .post(`/${apiPrefix}/payments/concepts/ensure-base`)
      .set(auth(adminTok!))
      .expect(201);

    const conceptRow = await db.query<{ id: string }>(
      `SELECT id FROM payment_concepts WHERE school_id = $1 ORDER BY name ASC LIMIT 1`,
      [student.school_id]
    );
    const conceptFallback = conceptRow.rows[0]
      ? conceptRow.rows[0]
      : (await db.query<{ id: string }>(`SELECT id FROM payment_concepts ORDER BY name ASC LIMIT 1`))
          .rows[0];
    expect(conceptFallback?.id).toBeDefined();

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);

    const debtRes = await request(app.getHttpServer())
      .post(`/${apiPrefix}/payments/debts`)
      .set(auth(adminTok!))
      .send({
        studentId: student.id,
        conceptId: conceptFallback.id,
        amount: 200,
        dueDate: futureDate.toISOString().slice(0, 10),
        description: 'E2E7 voucher rechazo'
      })
      .expect(201);
    const debtId = debtRes.body.id as string;

    for (let i = 0; i < 3; i++) {
      const upPath = `/uploads/comprobantes/phase7-${Date.now()}-${i}.pdf`;
      await request(app.getHttpServer())
        .post(`/${apiPrefix}/payments/debts/${debtId}/voucher`)
        .set(auth(padreTok!))
        .send({ voucherPath: upPath })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/${apiPrefix}/payments/debts/${debtId}/reject-voucher`)
        .set(auth(adminTok!))
        .send({ reason: `Rechazo de prueba #${i + 1}` })
        .expect(201);
    }

    await request(app.getHttpServer())
      .post(`/${apiPrefix}/payments/debts/${debtId}/voucher`)
      .set(auth(padreTok!))
      .send({ voucherPath: '/uploads/comprobantes/phase7-final.pdf' })
      .expect(400);
  });

  it('Lifecycle revocación: desactivar al docente invalida su JWT en la siguiente request (401)', async () => {
    const stamp = Date.now();
    const email = `docente.e2e7.${stamp}@escuelapass.local`;
    const school = (
      await db.query<{ id: string }>(`SELECT id FROM schools WHERE code = 'ESCUELA-PRINCIPAL'`)
    ).rows[0];
    await db.query(
      `INSERT INTO users (email, password_hash, role, full_name, can_access_campus, status, school_id)
       VALUES ($1, crypt('Docente123*', gen_salt('bf')), 'DOCENTE', 'Docente E2E7', true, true, $2)`,
      [email, school.id]
    );
    await db.query(
      `INSERT INTO teachers (user_id, employee_number, lifecycle_status)
       SELECT u.id, $1, 'ACTIVO' FROM users u WHERE u.email = $2`,
      [`DOC-E2E7-${stamp}`, email]
    );

    const teacher = await login(email, 'Docente123*');
    expect(teacher).toBeTruthy();

    await request(app.getHttpServer())
      .get(`/${apiPrefix}/auth/me`)
      .set(auth(teacher!.accessToken))
      .expect(200);

    // Simular lifecycle BAJA (efecto idéntico: users.status=false)
    await db.query(`UPDATE users SET status = false WHERE email = $1`, [email]);

    await request(app.getHttpServer())
      .get(`/${apiPrefix}/auth/me`)
      .set(auth(teacher!.accessToken))
      .expect(401);

    await db.query(`DELETE FROM teachers WHERE user_id IN (SELECT id FROM users WHERE email = $1)`, [
      email
    ]);
    await db.query(`DELETE FROM users WHERE email = $1`, [email]);
  });

  it('Calificaciones publicadas: docente sin force 400; docente con force 403; ADMIN con force 200 + audit', async () => {
    const adminTok = await tokenFor('admin@escuelapass.local', 'Admin123*');
    const docenteTok = await tokenFor('docente1@escuelapass.local', 'Docente123*');
    expect(adminTok).toBeTruthy();
    expect(docenteTok).toBeTruthy();
    const student = await findStudent('alumno1@escuelapass.local');
    expect(student.group_id).toBeTruthy();

    const teacherId = await findTeacherIdByEmail('docente1@escuelapass.local');
    const subject = (
      await db.query<{ id: string }>(
        `SELECT id FROM subjects WHERE school_id = $1 ORDER BY name ASC LIMIT 1`,
        [student.school_id]
      )
    ).rows[0];
    const period = (
      await db.query<{ id: string }>(
        `SELECT id FROM academic_periods
         WHERE school_id = $1 AND status = 'ACTIVE'
         ORDER BY order_index ASC LIMIT 1`,
        [student.school_id]
      )
    ).rows[0];
    expect(period?.id).toBeDefined();

    await db.query(
      `INSERT INTO teacher_groups (teacher_id, group_id, subject_id, is_main_teacher, can_authorize_departures)
       VALUES ($1, $2, $3, true, true)
       ON CONFLICT (teacher_id, group_id, subject_id) DO NOTHING`,
      [teacherId, student.group_id, subject.id]
    );

    const activity = await request(app.getHttpServer())
      .post(`/${apiPrefix}/activities`)
      .set(auth(docenteTok!))
      .send({
        groupId: student.group_id,
        subjectId: subject.id,
        periodId: period.id,
        title: `E2E7 Publicada ${Date.now()}`
      })
      .expect(201);

    const yearLabel = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    await db.query(
      `INSERT INTO report_cards (student_id, school_id, school_year, type, period_id, status, generated_at, published_at)
       VALUES ($1, $2, $3, 'PERIOD', $4, 'PUBLISHED', NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [student.id, student.school_id, yearLabel, period.id]
    );

    // Docente sin force → 400
    await request(app.getHttpServer())
      .post(`/${apiPrefix}/activities/${activity.body.id}/grades`)
      .set(auth(docenteTok!))
      .send({ entries: [{ studentId: student.id, score: 50 }] })
      .expect(400);

    // Docente con force=true → 403 (solo ADMIN)
    await request(app.getHttpServer())
      .post(`/${apiPrefix}/activities/${activity.body.id}/grades`)
      .set(auth(docenteTok!))
      .send({ entries: [{ studentId: student.id, score: 51 }], force: true })
      .expect(403);

    // ADMIN con force=true → 200/201 + audit con force:true en metadata.
    // Usamos el operador JSON `->>` para comparar booleans sin depender del
    // formato textual concreto que produzca jsonb::text.
    const before = await db.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM audit_logs
       WHERE action = 'grades.activity.save'
         AND metadata->>'force' = 'true'`
    );
    const res = await request(app.getHttpServer())
      .post(`/${apiPrefix}/activities/${activity.body.id}/grades`)
      .set(auth(adminTok!))
      .send({ entries: [{ studentId: student.id, score: 60 }], force: true });
    expect([200, 201]).toContain(res.status);
    const after = await db.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM audit_logs
       WHERE action = 'grades.activity.save'
         AND metadata->>'force' = 'true'`
    );
    expect(Number(after.rows[0].c)).toBeGreaterThan(Number(before.rows[0].c));

    await db.query(`DELETE FROM report_cards WHERE student_id = $1 AND period_id = $2`, [
      student.id,
      period.id
    ]);
  });

  describe('Files autorización (matriz IDOR negativa)', () => {
    let voucherFilename: string;

    beforeAll(async () => {
      const comprobantesDir = resolve(process.cwd(), 'uploads', 'comprobantes');
      if (!existsSync(comprobantesDir)) {
        mkdirSync(comprobantesDir, { recursive: true });
      }
      voucherFilename = `phase7-comp-${Date.now()}.pdf`;
      await writeMinimalValidPdf(resolve(comprobantesDir, voucherFilename));
    });

    afterAll(() => {
      removeE2eUploadFixture(resolve(process.cwd(), 'uploads', 'comprobantes', voucherFilename));
    });

    it('GET /files/comprobantes/* sin JWT devuelve 401', async () => {
      await request(app.getHttpServer())
        .get(`/${apiPrefix}/files/comprobantes/${voucherFilename}`)
        .expect(401);
    });

    // Este caso crea un nuevo padre y necesita un login fresco (no se puede
    // cachear). Si el AUTH_THROTTLE está cerca del límite, el retry de login
    // puede tomar varios segundos, así que ampliamos el timeout.
    it('Padre A no puede acceder a comprobante de hijo del Padre B (403); Padre B sí (200)', async () => {
      const stamp = Date.now();
      const pBEmail = `padre.b.${stamp}@escuelapass.local`;
      const sBEmail = `alumno.b.${stamp}@escuelapass.local`;
      const school = (
        await db.query<{ id: string }>(`SELECT id FROM schools WHERE code = 'ESCUELA-PRINCIPAL'`)
      ).rows[0];
      const group = (
        await db.query<{ id: string }>(`SELECT id FROM groups WHERE school_id = $1 LIMIT 1`, [
          school.id
        ])
      ).rows[0];

      await db.query(
        `INSERT INTO users (email, password_hash, role, full_name, school_id, status, can_access_campus)
         VALUES
           ($1, crypt('Padre123*', gen_salt('bf')), 'PADRE', 'Padre B E2E7', $3, true, true),
           ($2, crypt('Alumno123*', gen_salt('bf')), 'ALUMNO', 'Alumno B E2E7', $3, true, true)`,
        [pBEmail, sBEmail, school.id]
      );
      await db.query(
        `INSERT INTO parents (user_id, is_primary_contact)
         SELECT id, true FROM users WHERE email = $1`,
        [pBEmail]
      );
      await db.query(
        `INSERT INTO students (user_id, matricula, group_id, school_id)
         SELECT u.id, 'PHASE7-' || substr(u.id::text, 1, 6), $1, $2
         FROM users u WHERE u.email = $3`,
        [group.id, school.id, sBEmail]
      );
      await db.query(
        `INSERT INTO student_parents (student_id, parent_id, relationship, is_primary, can_pickup)
         SELECT s.id, p.id, 'PADRE', true, true
         FROM students s
         JOIN users su ON su.id = s.user_id
         JOIN parents p ON p.user_id = (SELECT id FROM users WHERE email = $1)
         WHERE su.email = $2`,
        [pBEmail, sBEmail]
      );

      const studentBId = (
        await db.query<{ id: string }>(
          `SELECT s.id FROM students s JOIN users u ON u.id = s.user_id WHERE u.email = $1`,
          [sBEmail]
        )
      ).rows[0].id;

      const concept = (
        await db.query<{ id: string }>(`SELECT id FROM payment_concepts ORDER BY name ASC LIMIT 1`)
      ).rows[0];
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const voucherPath = `/uploads/comprobantes/${voucherFilename}`;
      await db.query(
        `INSERT INTO debts (student_id, concept_id, amount, due_date, status, voucher_path)
         VALUES ($1, $2, 100, $3::date, 'PENDIENTE', $4)`,
        [studentBId, concept.id, futureDate.toISOString().slice(0, 10), voucherPath]
      );

      const padreATok = await tokenFor('padre1@escuelapass.local', 'Padre123*');
      expect(padreATok).toBeTruthy();
      await request(app.getHttpServer())
        .get(`/${apiPrefix}/files/comprobantes/${voucherFilename}`)
        .set(auth(padreATok!))
        .expect(403);

      const padreB = await login(pBEmail, 'Padre123*');
      expect(padreB).toBeTruthy();
      await request(app.getHttpServer())
        .get(`/${apiPrefix}/files/comprobantes/${voucherFilename}`)
        .set(auth(padreB!.accessToken))
        .expect(200);

      // Cleanup
      await db.query(`DELETE FROM debts WHERE voucher_path = $1`, [voucherPath]);
      await db.query(
        `DELETE FROM student_parents WHERE student_id IN (
           SELECT s.id FROM students s JOIN users u ON u.id = s.user_id WHERE u.email = $1
         )`,
        [sBEmail]
      );
      await db.query(
        `DELETE FROM students WHERE user_id IN (SELECT id FROM users WHERE email = $1)`,
        [sBEmail]
      );
      await db.query(
        `DELETE FROM parents WHERE user_id IN (SELECT id FROM users WHERE email = $1)`,
        [pBEmail]
      );
      await db.query(`DELETE FROM users WHERE email IN ($1, $2)`, [pBEmail, sBEmail]);
    }, 120_000);

    it('ADMINISTRATIVO de otra escuela no puede leer reports/* de la escuela principal (403)', async () => {
      const reportsDir = resolve(process.cwd(), 'uploads', 'reports');
      if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });
      const filename = `phase7-report-${Date.now()}.pdf`;
      const reportAbs = resolve(reportsDir, filename);
      await writeMinimalValidPdf(reportAbs);

      const stamp = Date.now();
      const otherCode = `ESCUELA-PHASE7-${stamp}`;
      await db.query(
        `INSERT INTO schools (name, code, status)
         VALUES ($1, $2, true) ON CONFLICT (code) DO NOTHING`,
        [`Escuela Phase7 ${stamp}`, otherCode]
      );
      const otherSchool = (
        await db.query<{ id: string }>(`SELECT id FROM schools WHERE code = $1`, [otherCode])
      ).rows[0];
      const principal = (
        await db.query<{ id: string }>(`SELECT id FROM schools WHERE code = 'ESCUELA-PRINCIPAL'`)
      ).rows[0];

      const adminOtherEmail = `admin.otra.${stamp}@escuelapass.local`;
      await db.query(
        `INSERT INTO users (email, password_hash, role, full_name, school_id, can_access_campus, status)
         VALUES ($1, crypt('Admin123*', gen_salt('bf')), 'ADMINISTRATIVO', 'Admin Otra Esc', $2, true, true)`,
        [adminOtherEmail, otherSchool.id]
      );
      // admin_reports.created_by_user_id debe existir; usamos administrativo@escuelapass.local
      await db.query(
        `INSERT INTO admin_reports (school_id, created_by_user_id, subject, message, status, type)
         SELECT $1, u.id, 'E2E7 Report', $2, 'PENDIENTE', 'OTRO'
         FROM users u WHERE u.email = 'administrativo@escuelapass.local'`,
        [principal.id, `Evidencia adjunta: /uploads/reports/${filename}`]
      );

      const adminOther = await login(adminOtherEmail, 'Admin123*');
      expect(adminOther).toBeTruthy();
      if (adminOther) {
        await request(app.getHttpServer())
          .get(`/${apiPrefix}/files/reports/${filename}`)
          .set(auth(adminOther.accessToken))
          .expect(403);
      }

      // Cleanup
      await db.query(`DELETE FROM admin_reports WHERE message = $1`, [
        `Evidencia adjunta: /uploads/reports/${filename}`
      ]);
      await db.query(`DELETE FROM users WHERE email = $1`, [adminOtherEmail]);
      await db.query(`DELETE FROM schools WHERE code = $1`, [otherCode]);

      removeE2eUploadFixture(reportAbs);
    });
  });

  it('/class-attendance/parent/me devuelve agrupación con registros para 2 hijos del padre', async () => {
    const padreTok = await tokenFor('padre1@escuelapass.local', 'Padre123*');
    expect(padreTok).toBeTruthy();
    const parent = await findParent('padre1@escuelapass.local');

    const stamp = Date.now();
    const school = (
      await db.query<{ id: string }>(`SELECT id FROM schools WHERE code = 'ESCUELA-PRINCIPAL'`)
    ).rows[0];
    const group = (
      await db.query<{ id: string }>(`SELECT id FROM groups WHERE school_id = $1 LIMIT 1`, [
        school.id
      ])
    ).rows[0];
    const s2Email = `alumno.s2.${stamp}@escuelapass.local`;

    await db.query(
      `INSERT INTO users (email, password_hash, role, full_name, school_id, status, can_access_campus)
       VALUES ($1, crypt('Alumno123*', gen_salt('bf')), 'ALUMNO', 'Alumno Dos E2E7', $2, true, true)`,
      [s2Email, school.id]
    );
    await db.query(
      `INSERT INTO students (user_id, matricula, group_id, school_id)
       SELECT u.id, 'PHASE7-S2-' || substr(u.id::text, 1, 6), $1, $2
       FROM users u WHERE u.email = $3`,
      [group.id, school.id, s2Email]
    );
    await db.query(
      `INSERT INTO student_parents (student_id, parent_id, relationship, is_primary, can_pickup)
       SELECT s.id, $1, 'PADRE', false, true
       FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE u.email = $2`,
      [parent.id, s2Email]
    );

    const res = await request(app.getHttpServer())
      .get(`/${apiPrefix}/class-attendance/parent/me`)
      .set(auth(padreTok!))
      .expect(200);

    expect(res.body && typeof res.body).toBe('object');
    const studentIds = Object.keys(res.body);
    expect(studentIds.length).toBeGreaterThanOrEqual(2);
    for (const id of studentIds) {
      expect(Array.isArray(res.body[id])).toBe(true);
    }

    // Cleanup
    await db.query(
      `DELETE FROM student_parents
       WHERE student_id IN (
         SELECT s.id FROM students s JOIN users u ON u.id = s.user_id WHERE u.email = $1
       )`,
      [s2Email]
    );
    await db.query(`DELETE FROM students WHERE user_id IN (SELECT id FROM users WHERE email = $1)`, [
      s2Email
    ]);
    await db.query(`DELETE FROM users WHERE email = $1`, [s2Email]);
  });

  it('JWT status off: admin desactiva usuario tras login y la próxima request responde 401', async () => {
    const stamp = Date.now();
    const email = `user.disable.${stamp}@escuelapass.local`;
    const school = (
      await db.query<{ id: string }>(`SELECT id FROM schools WHERE code = 'ESCUELA-PRINCIPAL'`)
    ).rows[0];
    await db.query(
      `INSERT INTO users (email, password_hash, role, full_name, school_id, status, can_access_campus)
       VALUES ($1, crypt('Pass123*', gen_salt('bf')), 'ADMINISTRATIVO', 'Disable E2E7', $2, true, true)`,
      [email, school.id]
    );

    const user = await login(email, 'Pass123*');
    expect(user).toBeTruthy();
    await request(app.getHttpServer())
      .get(`/${apiPrefix}/auth/me`)
      .set(auth(user!.accessToken))
      .expect(200);

    await db.query(`UPDATE users SET status = false WHERE email = $1`, [email]);

    await request(app.getHttpServer())
      .get(`/${apiPrefix}/auth/me`)
      .set(auth(user!.accessToken))
      .expect(401);

    await db.query(`DELETE FROM users WHERE email = $1`, [email]);
  });

  it('Privacy gate: usuario sin aceptación recibe [] en /privacy/me/acceptances y mantiene acceso al backend', async () => {
    const stamp = Date.now();
    const email = `nuevo.${stamp}@escuelapass.local`;
    const school = (
      await db.query<{ id: string }>(`SELECT id FROM schools WHERE code = 'ESCUELA-PRINCIPAL'`)
    ).rows[0];
    await db.query(
      `INSERT INTO users (email, password_hash, role, full_name, school_id, status, can_access_campus)
       VALUES ($1, crypt('Pass123*', gen_salt('bf')), 'ADMINISTRATIVO', 'Nuevo E2E7', $2, true, true)`,
      [email, school.id]
    );

    const user = await login(email, 'Pass123*');
    expect(user).toBeTruthy();

    const me = await request(app.getHttpServer())
      .get(`/${apiPrefix}/auth/me`)
      .set(auth(user!.accessToken))
      .expect(200);
    expect(me.body.email).toBe(email);

    const latest = await request(app.getHttpServer())
      .get(`/${apiPrefix}/privacy/policy/latest`)
      .set(auth(user!.accessToken))
      .expect(200);
    expect(latest.body).toBeDefined();

    const accs = await request(app.getHttpServer())
      .get(`/${apiPrefix}/privacy/me/acceptances`)
      .set(auth(user!.accessToken))
      .expect(200);
    expect(Array.isArray(accs.body)).toBe(true);
    expect(accs.body.length).toBe(0);

    await db.query(`DELETE FROM users WHERE email = $1`, [email]);
  });

});
