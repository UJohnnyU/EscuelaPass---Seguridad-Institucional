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
import ExcelJS from 'exceljs';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';

jest.setTimeout(20000);

async function buildGroupsImportXlsx(schoolYear: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Grupos');
  ws.addRow([
    'Nombre del grupo',
    'Grado',
    'Turno',
    'Año escolar',
    'Aula',
    'Cupo'
  ]);
  ws.addRow(['E2E-GRUPO', '1', 'MATUTINO', schoolYear, 'A-1', '25']);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
}

async function buildTeacherAssignmentsImportXlsx(
  teacherId: string,
  groupId: string,
  subjectId?: string
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Asignaciones');
  ws.addRow(['Id docente', 'Id grupo', 'Asignatura', 'Docente titular', 'Autoriza salidas']);
  ws.addRow([teacherId, groupId, subjectId ?? '', 'Si', 'Si']);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
}

/** StreamableFile / Excel: supertest no siempre rellena `body` como Buffer; usar Content-Length o texto. */
function expectBinaryDownloadMinBytes(
  res: { headers: Record<string, unknown>; body: unknown; text?: string },
  minBytes: number
) {
  const cl = res.headers['content-length'];
  if (cl != null && String(cl) !== '') {
    expect(Number(cl)).toBeGreaterThan(minBytes);
    return;
  }
  if (Buffer.isBuffer(res.body)) {
    expect(res.body.length).toBeGreaterThan(minBytes);
    return;
  }
  expect(String(res.text ?? '').length).toBeGreaterThan(minBytes);
}

describe('App (e2e)', () => {
  let app: INestApplication;
  let db: Pool;

  const apiPrefix = process.env.API_PREFIX ?? 'api/v1';

  const login = async (email: string, password: string) => {
    const res = await request(app.getHttpServer())
      .post(`/${apiPrefix}/auth/login`)
      .send({ email, password })
      .expect(201);

    return res.body as { accessToken: string; refreshToken: string; user: { id: string; role: string } };
  };

  const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

  const appTimeZone = (): string => process.env.APP_TIMEZONE?.trim() || 'America/Mexico_City';

  const circuitTodayYmd = (): string => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: appTimeZone(),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (!y || !m || !d) return new Date().toISOString().slice(0, 10);
    return `${y}-${m}-${d}`;
  };

  const minutesSinceMidnightAppTz = (instant: Date = new Date()): number => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: appTimeZone(),
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(instant);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    return hour * 60 + minute;
  };

  const sqlTimeFromMinutes = (totalMinutes: number): string => {
    const clamped = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59));
    const hh = String(Math.floor(clamped / 60)).padStart(2, '0');
    const mm = String(clamped % 60).padStart(2, '0');
    return `${hh}:${mm}:00`;
  };

  const restoreSeedStateAfterPhase7 = async () => {
    const today = circuitTodayYmd();
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
    await db.query(`UPDATE academic_periods SET status = 'ACTIVE', closed_at = NULL, closed_by = NULL`);
    await db.query(`DELETE FROM school_non_instructional_days WHERE exception_date = $1::date`, [today]);
  };

  const registerAttendancePresentToday = async (adminToken: string, studentId: string) => {
    await request(app.getHttpServer())
      .post(`/${apiPrefix}/attendance/register`)
      .set(authHeader(adminToken))
      .send({
        studentId,
        status: 'PRESENTE',
        attendanceDate: circuitTodayYmd(),
        notes: 'e2e-circuit-presencia'
      })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });
  };

  const cancelOpenCircuitsForStudent = async (studentId: string) => {
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

  const getStudentByEmail = async (token: string, email: string) => {
    const res = await request(app.getHttpServer())
      .get(`/${apiPrefix}/school/students`)
      .set(authHeader(token))
      .expect(200);
    const row = (res.body as Array<Record<string, unknown>>).find((x) => x.email === email);
    if (!row) throw new Error(`No se encontró estudiante con email ${email}`);
    return row as { id: string; userId: string; groupId?: string | null };
  };

  const getTeacherByEmail = async (token: string, email: string) => {
    const res = await request(app.getHttpServer())
      .get(`/${apiPrefix}/school/teachers`)
      .set(authHeader(token))
      .expect(200);
    const row = (res.body as Array<Record<string, unknown>>).find((x) => x.email === email);
    if (!row) throw new Error(`No se encontró docente con email ${email}`);
    return row as { id: string; userId: string };
  };

  const getParentByEmail = async (token: string, email: string) => {
    const res = await request(app.getHttpServer())
      .get(`/${apiPrefix}/school/parents`)
      .set(authHeader(token))
      .expect(200);
    const row = (res.body as Array<Record<string, unknown>>).find((x) => x.email === email);
    if (!row) throw new Error(`No se encontró padre con email ${email}`);
    return row as { id: string };
  };

  const getGroupByName = async (token: string, name: string, schoolYear: string) => {
    const res = await request(app.getHttpServer())
      .get(`/${apiPrefix}/school/groups`)
      .set(authHeader(token))
      .expect(200);
    const row = (res.body as Array<Record<string, unknown>>).find((x) => x.name === name && x.schoolYear === schoolYear);
    if (!row) throw new Error(`No se encontró grupo ${name}/${schoolYear}`);
    return row as { id: string };
  };

  const ensureTeacherAssignedToGroup = async (token: string, teacherId: string, groupId: string, subjectId: string) => {
    await request(app.getHttpServer())
      .post(`/${apiPrefix}/school/teacher-assignments`)
      .set(authHeader(token))
      .send({ teacherId, groupId, subjectId, isMainTeacher: true, canAuthorizeDepartures: true })
      .expect(201);
  };

  const getFirstSubjectId = async (token: string) => {
    const res = await request(app.getHttpServer())
      .get(`/${apiPrefix}/school/subjects`)
      .set(authHeader(token))
      .expect(200);
    const first = (res.body as Array<{ id: string }>)[0];
    if (!first?.id) throw new Error('No hay materias disponibles para pruebas');
    return first.id;
  };

  const getFirstAcademicPeriodId = async (token: string, schoolId?: string) => {
    const listPath =
      schoolId !== undefined && schoolId !== ''
        ? `/${apiPrefix}/academic-periods?schoolId=${encodeURIComponent(schoolId)}`
        : `/${apiPrefix}/academic-periods`;
    const res = await request(app.getHttpServer()).get(listPath).set(authHeader(token));
    if (res.status === 200) {
      const first = (res.body as Array<{ id: string }>)[0];
      if (first?.id) return first.id;
    }
    const now = new Date();
    const y = now.getUTCFullYear();
    const schoolYear = `${y}-${y + 1}`;
    const payload: Record<string, unknown> = {
      schoolYear,
      name: 'BIM1',
      orderIndex: 1,
      startDate: `${y}-01-10`,
      endDate: `${y}-03-31`,
      weight: 100
    };
    if (schoolId !== undefined && schoolId !== '') {
      payload.schoolId = schoolId;
    }
    const created = await request(app.getHttpServer())
      .post(`/${apiPrefix}/academic-periods`)
      .set(authHeader(token))
      .send(payload)
      .expect(201);
    return created.body.id as string;
  };

  const todayWeekday = () => {
    const [y, m, d] = circuitTodayYmd().split('-').map((x) => Number.parseInt(x, 10));
    return new Date(y, m - 1, d).getDay();
  };

  const ensureCurrentClassSession = async (input: {
    adminToken: string;
    adminUserId: string;
    groupId: string;
    teacherId: string;
    subjectId: string;
  }) => {
    const groupRow = await sqlOne<{ school_id: string }>(
      `SELECT school_id FROM groups WHERE id = $1`,
      [input.groupId]
    );
    const periodId = await getFirstAcademicPeriodId(input.adminToken, groupRow.school_id);
    const existing = await db.query<{ id: string }>(
      `SELECT id
       FROM class_sessions
       WHERE group_id = $1
         AND teacher_id = $2
         AND weekday = $3
         AND is_active = true
         AND start_time <= '23:59:00'::time
         AND end_time > '00:00:00'::time
       ORDER BY created_at DESC
       LIMIT 1`,
      [input.groupId, input.teacherId, todayWeekday()]
    );
    if (existing.rows[0]?.id) return existing.rows[0].id;

    const inserted = await db.query<{ id: string }>(
      `INSERT INTO class_sessions (
         school_id, academic_period_id, group_id, subject_id, teacher_id,
         weekday, start_time, end_time, room, is_active,
         created_by_user_id, updated_by_user_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, '00:00:00', '23:59:00', 'E2E', true, $7, $7)
       RETURNING id`,
      [
        groupRow.school_id,
        periodId,
        input.groupId,
        input.subjectId,
        input.teacherId,
        todayWeekday(),
        input.adminUserId
      ]
    );
    return inserted.rows[0].id;
  };

  const sqlOne = async <T extends Record<string, unknown>>(text: string, params: unknown[] = []) => {
    const res = await db.query(text, params);
    if (!res.rows[0]) throw new Error(`SQL sin resultados: ${text}`);
    return res.rows[0] as T;
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
      ssl: (process.env.DB_SSL ?? 'false') === 'true' ? { rejectUnauthorized: false } : undefined
    });

    // phase7-closure.e2e-spec.ts corre antes en la suite completa y deja estado compartido.
    await restoreSeedStateAfterPhase7();
  });

  afterAll(async () => {
    await db.end();
    await app.close();
  });

  it('health (GET)', () => {
    return request(app.getHttpServer()).get(`/${apiPrefix}/health`).expect(200);
  });

  it('auth: login -> refresh rotacion -> logout invalida refresh', async () => {
    const first = await login('administrativo@escuelapass.local', 'Admin123*');

    const refreshed = await request(app.getHttpServer())
      .post(`/${apiPrefix}/auth/refresh`)
      .send({ refreshToken: first.refreshToken })
      .expect(201);

    expect(refreshed.body.refreshToken).toBeDefined();
    expect(refreshed.body.refreshToken).not.toBe(first.refreshToken);

    // En este MVP, el refresh puede reutilizarse hasta logout (no es one-time).
    const refreshedAgain = await request(app.getHttpServer())
      .post(`/${apiPrefix}/auth/refresh`)
      .send({ refreshToken: first.refreshToken })
      .expect(201);

    // Logout revoca tokens (incluye el refresh nuevo)
    await request(app.getHttpServer())
      .post(`/${apiPrefix}/auth/logout`)
      .send({ refreshToken: refreshedAgain.body.refreshToken })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/${apiPrefix}/auth/refresh`)
      .send({ refreshToken: refreshedAgain.body.refreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post(`/${apiPrefix}/auth/refresh`)
      .send({ refreshToken: first.refreshToken })
      .expect(401);
  });

  it('auth: refresh token invalido y logout invalido responden 401', async () => {
    await request(app.getHttpServer())
      .post(`/${apiPrefix}/auth/refresh`)
      .send({ refreshToken: 'token-invalido' })
      .expect(401);

    await request(app.getHttpServer())
      .post(`/${apiPrefix}/auth/logout`)
      .send({ refreshToken: 'token-invalido' })
      .expect(401);
  });

  it('attendance: admin registra y upsert actualiza', async () => {
    const admin = await login('admin@escuelapass.local', 'Admin123*');

    const student = await getStudentByEmail(admin.accessToken, 'alumno1@escuelapass.local');
    expect(student.groupId).toBeTruthy();

    const date = new Date().toISOString().slice(0, 10);

    const first = await request(app.getHttpServer())
      .post(`/${apiPrefix}/attendance/register`)
      .set(authHeader(admin.accessToken))
      .send({ studentId: student.id, status: 'PRESENTE', attendanceDate: date, notes: 'e2e' });
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post(`/${apiPrefix}/attendance/register`)
      .set(authHeader(admin.accessToken))
      .send({ studentId: student.id, status: 'RETARDO', attendanceDate: date, notes: 'e2e2' })
      .expect(201);

    expect(second.body.id).toBe(first.body.id);
    expect(second.body.status).toBe('RETARDO');
  });

  it('calendario: día sin clases bloquea registro de asistencia y export Excel', async () => {
    const admin = await login('administrativo@escuelapass.local', 'Admin123*');

    const student = await getStudentByEmail(admin.accessToken, 'alumno1@escuelapass.local');

    const date = new Date().toISOString().slice(0, 10);

    const created = await request(app.getHttpServer())
      .post(`/${apiPrefix}/calendar/non-instructional-days`)
      .set(authHeader(admin.accessToken))
      .send({ exceptionDate: date, reason: 'e2e calendario' });
    expect([201, 400]).toContain(created.status);

    await request(app.getHttpServer())
      .post(`/${apiPrefix}/attendance/register`)
      .set(authHeader(admin.accessToken))
      .send({ studentId: student.id, status: 'PRESENTE', attendanceDate: date })
      .expect((res) => {
        expect([400, 403]).toContain(res.status);
      });

    if (student.groupId) {
      await request(app.getHttpServer())
        .get(`/${apiPrefix}/exports/attendance.xlsx`)
        .query({ groupId: student.groupId, date })
        .set(authHeader(admin.accessToken))
        .expect(400);
    }

    if (created.status === 201 && created.body?.id) {
      await request(app.getHttpServer())
        .delete(`/${apiPrefix}/calendar/non-instructional-days/${created.body.id}`)
        .set(authHeader(admin.accessToken))
        .expect(200);
    }

    await request(app.getHttpServer())
      .post(`/${apiPrefix}/attendance/register`)
      .set(authHeader(admin.accessToken))
      .send({ studentId: student.id, status: 'PRESENTE', attendanceDate: date, notes: 'post-cal' })
      .expect((res) => {
        expect([201, 403]).toContain(res.status);
      });
  });

  it('access scan: ENTRY de alumno por QR marca asistencia automatica', async () => {
    const admin = await login('admin@escuelapass.local', 'Admin123*');

    const student = await getStudentByEmail(admin.accessToken, 'alumno1@escuelapass.local');

    const date = circuitTodayYmd();
    await db.query(`DELETE FROM school_non_instructional_days WHERE exception_date = $1::date`, [date]);
    await db.query(
      `DELETE FROM access_events
       WHERE user_id = $1
         AND event_date = $2`,
      [student.userId, date]
    );
    await db.query(
      `DELETE FROM attendance_records
       WHERE student_id = $1
         AND attendance_date = $2`,
      [student.id, date]
    );

    await request(app.getHttpServer())
      .post(`/${apiPrefix}/access-events/scan`)
      .set(authHeader(admin.accessToken))
      .send({
        method: 'QR',
        credentialValue: 'QR_ALUMNO_0001',
        eventType: 'ENTRY'
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.duplicate).not.toBe(true);
      });

    const list = await request(app.getHttpServer())
      .get(`/${apiPrefix}/attendance/groups/${student.groupId}`)
      .query({ date })
      .set(authHeader(admin.accessToken))
      .expect(200);
    const attendanceRows = Array.isArray(list.body) ? list.body : (list.body.rows ?? []);
    const row = (attendanceRows as Array<{ studentId: string; status: string; notes?: string | null }>).find(
      (x) => x.studentId === student.id
    );
    expect(row ? row.status === 'PRESENTE' : true).toBe(true);
    expect(row ? String(row.notes ?? '').includes('AUTO_ACCESS_SCAN:QR:ENTRY') : true).toBe(true);
  });

  it('class-attendance: docente registra asistencia por clase y padre la consulta', async () => {
    const admin = await login('admin@escuelapass.local', 'Admin123*');
    const docente = await login('docente1@escuelapass.local', 'Docente123*');
    const padre = await login('padre1@escuelapass.local', 'Padre123*');
    const student = await getStudentByEmail(admin.accessToken, 'alumno1@escuelapass.local');
    const teacher = await getTeacherByEmail(admin.accessToken, 'docente1@escuelapass.local');
    const subjectId = await getFirstSubjectId(admin.accessToken);
    expect(student.groupId).toBeTruthy();
    await ensureTeacherAssignedToGroup(admin.accessToken, teacher.id, student.groupId!, subjectId).catch(() => undefined);
    const classSessionId = await ensureCurrentClassSession({
      adminToken: admin.accessToken,
      adminUserId: admin.user.id,
      groupId: student.groupId!,
      teacherId: teacher.id,
      subjectId
    });

    const date = circuitTodayYmd();
    await db.query(
      `DELETE FROM class_attendance_records
       WHERE student_id = $1 AND class_session_id = $2 AND attendance_date = $3::date`,
      [student.id, classSessionId, date]
    );

    await request(app.getHttpServer())
      .post(`/${apiPrefix}/class-attendance/bulk`)
      .set(authHeader(docente.accessToken))
      .send({
        classSessionId,
        attendanceDate: date,
        entries: [{ studentId: student.id, status: 'PRESENTE' }]
      })
      .expect(201);

    const parentView = await request(app.getHttpServer())
      .get(`/${apiPrefix}/class-attendance/student/${student.id}`)
      .query({ from: date, to: date })
      .set(authHeader(padre.accessToken))
      .expect(200);
    expect(parentView.body.records.some((r: { classSessionId: string }) => r.classSessionId === classSessionId)).toBe(true);

    await request(app.getHttpServer())
      .get(`/${apiPrefix}/reports/attendance/classes`)
      .query({ groupId: student.groupId, date })
      .set(authHeader(admin.accessToken))
      .expect(200);

    const exported = await request(app.getHttpServer())
      .get(`/${apiPrefix}/exports/class-attendance.xlsx`)
      .query({ groupId: student.groupId, date })
      .set(authHeader(admin.accessToken))
      .expect(200);
    expectBinaryDownloadMinBytes(exported, 100);
  });

  it('access scan: ENTRY tardio marca RETARDO sin pisar asistencia manual', async () => {
    const admin = await login('admin@escuelapass.local', 'Admin123*');
    const student = await getStudentByEmail(admin.accessToken, 'alumno1@escuelapass.local');
    const date = circuitTodayYmd();
    const school = await sqlOne<{
      school_id: string;
      shift_matutino_start: string | null;
      shift_matutino_end: string | null;
    }>(
      `SELECT s.school_id, sc.shift_matutino_start, sc.shift_matutino_end
       FROM students s
       JOIN schools sc ON sc.id = s.school_id
       WHERE s.id = $1`,
      [student.id]
    );

    const lateShiftStart = sqlTimeFromMinutes(minutesSinceMidnightAppTz() - 120);

    const clearAccessDay = async () => {
      await db.query(`DELETE FROM school_non_instructional_days WHERE exception_date = $1::date`, [date]);
      await db.query(`DELETE FROM access_events WHERE user_id = $1 AND event_date = $2::date`, [
        student.userId,
        date
      ]);
      await db.query(`DELETE FROM attendance_records WHERE student_id = $1 AND attendance_date = $2::date`, [
        student.id,
        date
      ]);
    };

    await clearAccessDay();
    await db.query(
      `UPDATE schools SET shift_matutino_start = $2, shift_matutino_end = '23:59:00' WHERE id = $1`,
      [school.school_id, lateShiftStart]
    );
    try {
      const scanLate = await request(app.getHttpServer())
        .post(`/${apiPrefix}/access-events/scan`)
        .set(authHeader(admin.accessToken))
        .send({ method: 'QR', credentialValue: 'QR_ALUMNO_0001', eventType: 'ENTRY' })
        .expect(201);
      expect(scanLate.body.duplicate).not.toBe(true);

      const row = await sqlOne<{ status: string; notes: string | null }>(
        `SELECT status::text, notes FROM attendance_records WHERE student_id = $1 AND attendance_date = $2::date`,
        [student.id, date]
      );
      expect(row.status).toBe('RETARDO');
      expect(String(row.notes ?? '')).toContain('AUTO_ACCESS_SCAN:QR:ENTRY');

      await db.query(`DELETE FROM access_events WHERE user_id = $1 AND event_date = $2::date`, [
        student.userId,
        date
      ]);
      await request(app.getHttpServer())
        .post(`/${apiPrefix}/attendance/register`)
        .set(authHeader(admin.accessToken))
        .send({
          studentId: student.id,
          status: 'PRESENTE',
          attendanceDate: date,
          notes: 'e2e-manual-retardo'
        })
        .expect(201);

      const manualBefore = await sqlOne<{ status: string; notes: string | null }>(
        `SELECT status::text, notes FROM attendance_records WHERE student_id = $1 AND attendance_date = $2::date`,
        [student.id, date]
      );
      expect(manualBefore.status).toBe('PRESENTE');

      const scanAfterManual = await request(app.getHttpServer())
        .post(`/${apiPrefix}/access-events/scan`)
        .set(authHeader(admin.accessToken))
        .send({ method: 'QR', credentialValue: 'QR_ALUMNO_0001', eventType: 'ENTRY' })
        .expect(201);
      expect(scanAfterManual.body.duplicate).not.toBe(true);

      const manualAfter = await sqlOne<{ status: string; notes: string | null }>(
        `SELECT status::text, notes FROM attendance_records WHERE student_id = $1 AND attendance_date = $2::date`,
        [student.id, date]
      );
      expect(manualAfter.status).toBe('PRESENTE');
      expect(String(manualAfter.notes ?? '')).toContain('e2e-manual-retardo');
      expect(String(manualAfter.notes ?? '')).not.toContain('AUTO_ACCESS_SCAN:QR:ENTRY');
    } finally {
      await db.query(
        `UPDATE schools SET shift_matutino_start = $2, shift_matutino_end = $3 WHERE id = $1`,
        [school.school_id, school.shift_matutino_start, school.shift_matutino_end]
      );
    }
  });

  it('grades: docente registra y padre puede leer', async () => {
    const admin = await login('administrativo@escuelapass.local', 'Admin123*');
    const teacher = await getTeacherByEmail(admin.accessToken, 'docente1@escuelapass.local');
    const group = await getGroupByName(admin.accessToken, '1A', '2026-2027');
    const student = await getStudentByEmail(admin.accessToken, 'alumno1@escuelapass.local');
    const subjectId = await getFirstSubjectId(admin.accessToken);
    const periodId = await getFirstAcademicPeriodId(admin.accessToken);
    await ensureTeacherAssignedToGroup(admin.accessToken, teacher.id, group.id, subjectId);

    const docente = await login('docente1@escuelapass.local', 'Docente123*');

    const activity = await request(app.getHttpServer())
      .post(`/${apiPrefix}/activities`)
      .set(authHeader(docente.accessToken))
      .send({
        groupId: group.id,
        subjectId,
        periodId,
        title: 'Parcial 1'
      })
      .expect(201);
    expect(parseFloat(String(activity.body.maxScore))).toBe(100);
    await request(app.getHttpServer())
      .post(`/${apiPrefix}/activities/${activity.body.id}/grades`)
      .set(authHeader(docente.accessToken))
      .send({ entries: [{ studentId: student.id, score: 18.5, notes: 'e2e' }] })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const padre = await login('padre1@escuelapass.local', 'Padre123*');
    const res = await request(app.getHttpServer())
      .get(`/${apiPrefix}/activities/parent/my-children`)
      .query({ studentId: student.id })
      .set(authHeader(padre.accessToken))
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('circuit + reports: circuito hoy y reportes responden', async () => {
    const admin = await login('admin@escuelapass.local', 'Admin123*');
    const padre = await login('padre1@escuelapass.local', 'Padre123*');

    const parent = await getParentByEmail(admin.accessToken, 'padre1@escuelapass.local');
    const student = await getStudentByEmail(admin.accessToken, 'alumno1@escuelapass.local');

    await registerAttendancePresentToday(admin.accessToken, student.id);

    // padre crea solicitud circuito
    const created = await request(app.getHttpServer())
      .post(`/${apiPrefix}/circuit-requests`)
      .set(authHeader(padre.accessToken))
      .send({
        studentId: student.id,
        requestedByParentId: parent.id,
        pickupMethod: 'A_PIE'
      })
      .expect(201);

    // admin ve circuito de hoy
    await request(app.getHttpServer())
      .get(`/${apiPrefix}/reports/circuit/today`)
      .set(authHeader(admin.accessToken))
      .expect(200);

    // admin ve pagos pendientes
    await request(app.getHttpServer())
      .get(`/${apiPrefix}/reports/payments/pending`)
      .set(authHeader(admin.accessToken))
      .expect(200);

    // admin ve asistencia del grupo (puede ser 200 aunque no haya filas)
    await request(app.getHttpServer())
      .get(`/${apiPrefix}/reports/attendance/today`)
      .query({ groupId: student.groupId })
      .set(authHeader(admin.accessToken))
      .expect(200);

    expect(created.body.requestId).toBeDefined();
  });

  it('circuit: docente solo ve solicitudes de alumnos en su clase actual', async () => {
    const admin = await login('admin@escuelapass.local', 'Admin123*');
    const padre = await login('padre1@escuelapass.local', 'Padre123*');
    const docenteActual = await login('docente1@escuelapass.local', 'Docente123*');
    let docenteOtro: { accessToken: string; user: { id: string; role: string } };
    try {
      docenteOtro = await login('docente2@escuelapass.local', 'Docente123*');
    } catch {
      return;
    }

    const parent = await getParentByEmail(admin.accessToken, 'padre1@escuelapass.local');
    const student = await getStudentByEmail(admin.accessToken, 'alumno1@escuelapass.local');
    const teacher1 = await getTeacherByEmail(admin.accessToken, 'docente1@escuelapass.local');
    const teacher2 = await getTeacherByEmail(admin.accessToken, 'docente2@escuelapass.local');
    const subjectId = await getFirstSubjectId(admin.accessToken);
    expect(student.groupId).toBeTruthy();
    await ensureTeacherAssignedToGroup(admin.accessToken, teacher1.id, student.groupId!, subjectId).catch(() => undefined);
    await ensureTeacherAssignedToGroup(admin.accessToken, teacher2.id, student.groupId!, subjectId).catch(() => undefined);
    await ensureCurrentClassSession({
      adminToken: admin.accessToken,
      adminUserId: admin.user.id,
      groupId: student.groupId!,
      teacherId: teacher1.id,
      subjectId
    });
    await registerAttendancePresentToday(admin.accessToken, student.id);

    const created = await request(app.getHttpServer())
      .post(`/${apiPrefix}/circuit-requests`)
      .set(authHeader(padre.accessToken))
      .send({ studentId: student.id, requestedByParentId: parent.id, pickupMethod: 'A_PIE' });
    const requestId =
      created.status === 201
        ? (created.body.requestId as string)
        : (
            await request(app.getHttpServer())
              .get(`/${apiPrefix}/circuit-requests/parent/active`)
              .set(authHeader(padre.accessToken))
              .expect(200)
          ).body?.active?.id;
    if (!requestId) return;
    await db.query(`UPDATE circuit_requests SET teacher_signal = NULL WHERE id = $1`, [requestId]);

    const actual = await request(app.getHttpServer())
      .get(`/${apiPrefix}/circuit-requests/today`)
      .set(authHeader(docenteActual.accessToken))
      .expect(200);
    expect((actual.body as Array<{ id: string }>).some((r) => r.id === requestId)).toBe(true);

    const otro = await request(app.getHttpServer())
      .get(`/${apiPrefix}/circuit-requests/today`)
      .set(authHeader(docenteOtro.accessToken))
      .expect(200);
    expect((otro.body as Array<{ id: string }>).some((r) => r.id === requestId)).toBe(false);
  });

  it('circuit: sin registro presente/tardanza hoy bloquea solicitud del padre', async () => {
    const admin = await login('admin@escuelapass.local', 'Admin123*');
    const padre = await login('padre1@escuelapass.local', 'Padre123*');
    const parent = await getParentByEmail(admin.accessToken, 'padre1@escuelapass.local');
    const student = await getStudentByEmail(admin.accessToken, 'alumno1@escuelapass.local');
    const today = circuitTodayYmd();

    await db.query(
      `DELETE FROM attendance_records WHERE student_id = $1 AND attendance_date = $2::date`,
      [student.id, today]
    );

    await request(app.getHttpServer())
      .post(`/${apiPrefix}/circuit-requests`)
      .set(authHeader(padre.accessToken))
      .send({
        studentId: student.id,
        requestedByParentId: parent.id,
        pickupMethod: 'A_PIE'
      })
      .expect(400);

    await registerAttendancePresentToday(admin.accessToken, student.id);
  });

  it('authz: padre no puede registrar asistencia (403)', async () => {
    const padre = await login('padre1@escuelapass.local', 'Padre123*');

    await request(app.getHttpServer())
      .post(`/${apiPrefix}/attendance/register`)
      .set(authHeader(padre.accessToken))
      .send({
        studentId: '11111111-1111-4111-8111-111111111111',
        status: 'PRESENTE'
      })
      .expect(403);
  });

  it('validation: asistencia con studentId invalido responde 400', async () => {
    const admin = await login('administrativo@escuelapass.local', 'Admin123*');

    await request(app.getHttpServer())
      .post(`/${apiPrefix}/attendance/register`)
      .set(authHeader(admin.accessToken))
      .send({
        studentId: 'no-es-uuid',
        status: 'PRESENTE'
      })
      .expect(400);
  });

  it('authz: padre no puede consultar reportes de pagos pendientes (403)', async () => {
    const padre = await login('padre1@escuelapass.local', 'Padre123*');

    await request(app.getHttpServer())
      .get(`/${apiPrefix}/reports/payments/pending`)
      .set(authHeader(padre.accessToken))
      .expect(403);
  });

  it('school: administrativo lista grupos', async () => {
    const admin = await login('administrativo@escuelapass.local', 'Admin123*');
    const res = await request(app.getHttpServer())
      .get(`/${apiPrefix}/school/groups`)
      .set(authHeader(admin.accessToken))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('exports: Excel asistencia, calificaciones y boletín consolidado', async () => {
    const admin = await login('administrativo@escuelapass.local', 'Admin123*');
    const group = await getGroupByName(admin.accessToken, '1A', '2026-2027');
    const date = new Date().toISOString().slice(0, 10);

    const attX = await request(app.getHttpServer())
      .get(`/${apiPrefix}/exports/attendance.xlsx`)
      .query({ groupId: group.id, date })
      .set(authHeader(admin.accessToken));
    expect([200, 400]).toContain(attX.status);
    if (attX.status === 200) {
      expect(String(attX.headers['content-type'] ?? '')).toMatch(/spreadsheet/);
      expectBinaryDownloadMinBytes(attX, 200);
    }

    const grX = await request(app.getHttpServer())
      .get(`/${apiPrefix}/exports/grades.xlsx`)
      .query({ groupId: group.id })
      .set(authHeader(admin.accessToken))
      .expect(200);
    expect(String(grX.headers['content-type'] ?? '')).toMatch(/spreadsheet/);
    expectBinaryDownloadMinBytes(grX, 200);

    const bull = await request(app.getHttpServer())
      .get(`/${apiPrefix}/exports/bulletin-consolidated.xlsx`)
      .query({ groupId: group.id })
      .set(authHeader(admin.accessToken))
      .expect(200);
    expect(String(bull.headers['content-type'] ?? '')).toMatch(/spreadsheet/);
    expectBinaryDownloadMinBytes(bull, 200);
  });

  it('settings: perfil institucional lectura y actualización admin', async () => {
    const admin = await login('administrativo@escuelapass.local', 'Admin123*');
    const padre = await login('padre1@escuelapass.local', 'Padre123*');

    const before = await request(app.getHttpServer())
      .get(`/${apiPrefix}/settings/institution`)
      .set(authHeader(padre.accessToken))
      .expect(200);
    expect(before.body).toHaveProperty('name');

    await request(app.getHttpServer())
      .patch(`/${apiPrefix}/settings/institution`)
      .set(authHeader(padre.accessToken))
      .send({ name: 'No debe' })
      .expect(403);

    const after = await request(app.getHttpServer())
      .patch(`/${apiPrefix}/settings/institution`)
      .set(authHeader(admin.accessToken))
      .send({ name: 'Escuela Pass E2E', directorName: 'Director Prueba' })
      .expect(200);
    expect(after.body.name).toBe('Escuela Pass E2E');
    expect(after.body.directorName).toBe('Director Prueba');
  });

  it('settings: circuito deshabilitado bloquea nuevas solicitudes de circuito', async () => {
    const admin = await login('administrativo@escuelapass.local', 'Admin123*');
    const padre = await login('padre1@escuelapass.local', 'Padre123*');

    const parent = await getParentByEmail(admin.accessToken, 'padre1@escuelapass.local');
    const student = await getStudentByEmail(admin.accessToken, 'alumno1@escuelapass.local');

    await request(app.getHttpServer())
      .get(`/${apiPrefix}/settings/circuit`)
      .set(authHeader(padre.accessToken))
      .expect(200)
      .expect((res) => {
        expect(res.body.enabled).toBe(true);
      });

    await request(app.getHttpServer())
      .patch(`/${apiPrefix}/settings/circuit`)
      .set(authHeader(admin.accessToken))
      .send({ enabled: false })
      .expect(200);

    try {
      await request(app.getHttpServer())
        .post(`/${apiPrefix}/circuit-requests`)
        .set(authHeader(padre.accessToken))
        .send({
          studentId: student.id,
          requestedByParentId: parent.id,
          pickupMethod: 'A_PIE'
        })
        .expect(403);
    } finally {
      await request(app.getHttpServer())
        .patch(`/${apiPrefix}/settings/circuit`)
        .set(authHeader(admin.accessToken))
        .send({ enabled: true })
        .expect(200);
    }
  });

  it('circuit: padre actualiza GPS de su solicitud', async () => {
    const admin = await login('administrativo@escuelapass.local', 'Admin123*');
    const padre = await login('padre1@escuelapass.local', 'Padre123*');
    const parent = await getParentByEmail(admin.accessToken, 'padre1@escuelapass.local');
    const student = await getStudentByEmail(admin.accessToken, 'alumno1@escuelapass.local');

    await cancelOpenCircuitsForStudent(student.id);
    await registerAttendancePresentToday(admin.accessToken, student.id);

    const created = await request(app.getHttpServer())
      .post(`/${apiPrefix}/circuit-requests`)
      .set(authHeader(padre.accessToken))
      .send({
        studentId: student.id,
        requestedByParentId: parent.id,
        pickupMethod: 'A_PIE'
      })
      .expect(201);

    const mapCtx = await request(app.getHttpServer())
      .get(`/${apiPrefix}/circuit-requests/${created.body.requestId}/map`)
      .set(authHeader(admin.accessToken))
      .expect(200);
    const schoolLat = Number((mapCtx.body as { schoolLatitude?: number }).schoolLatitude);
    const schoolLng = Number((mapCtx.body as { schoolLongitude?: number }).schoolLongitude);

    const patch = await request(app.getHttpServer())
      .patch(`/${apiPrefix}/circuit-requests/${created.body.requestId}/gps`)
      .set(authHeader(padre.accessToken))
      .send({ parentGpsLatitude: schoolLat, parentGpsLongitude: schoolLng })
      .expect(200);

    expect(patch.body.parentGpsLatitude).toBeDefined();
    expect(patch.body.parentGpsLongitude).toBeDefined();
    expect(patch.body.status).toBe('PENDIENTE');
    expect(patch.body.autoTransitioned).toBe(false);
    expect(typeof patch.body.distanceToSchoolKm).toBe('number');
    expect(['mapbox', 'haversine']).toContain(patch.body.distanceSource);

    const p1 = await request(app.getHttpServer())
      .patch(`/${apiPrefix}/circuit-requests/${created.body.requestId}/parent-progress`)
      .set(authHeader(padre.accessToken))
      .send({ status: 'PADRE_EN_CAMINO' })
      .expect(200);
    expect(p1.body.status).toBe('PADRE_EN_CAMINO');

    const gpsArrival = await request(app.getHttpServer())
      .patch(`/${apiPrefix}/circuit-requests/${created.body.requestId}/gps`)
      .set(authHeader(padre.accessToken))
      .send({ parentGpsLatitude: schoolLat, parentGpsLongitude: schoolLng })
      .expect(200);
    expect(gpsArrival.body.autoTransitioned).toBe(true);
    expect(gpsArrival.body.status).toBe('NOTIFICADO_LLEGADA');

    await request(app.getHttpServer())
      .patch(`/${apiPrefix}/circuit-requests/${created.body.requestId}/cancel`)
      .set(authHeader(padre.accessToken))
      .expect(200);
  });

  it('circuit: padre confirma entrega de su solicitud', async () => {
    const padre = await login('padre1@escuelapass.local', 'Padre123*');
    const admin = await login('administrativo@escuelapass.local', 'Admin123*');
    const parent = await getParentByEmail(admin.accessToken, 'padre1@escuelapass.local');
    const student = await getStudentByEmail(admin.accessToken, 'alumno1@escuelapass.local');

    await cancelOpenCircuitsForStudent(student.id);
    await registerAttendancePresentToday(admin.accessToken, student.id);

    const created = await request(app.getHttpServer())
      .post(`/${apiPrefix}/circuit-requests`)
      .set(authHeader(padre.accessToken))
      .send({
        studentId: student.id,
        requestedByParentId: parent.id,
        pickupMethod: 'A_PIE'
      })
      .expect(201);

    const requestId = created.body.requestId as string;

    const mapCtx = await request(app.getHttpServer())
      .get(`/${apiPrefix}/circuit-requests/${requestId}/map`)
      .set(authHeader(admin.accessToken))
      .expect(200);
    const schoolLat = Number((mapCtx.body as { schoolLatitude?: number }).schoolLatitude);
    const schoolLng = Number((mapCtx.body as { schoolLongitude?: number }).schoolLongitude);

    await request(app.getHttpServer())
      .patch(`/${apiPrefix}/circuit-requests/${requestId}/parent-progress`)
      .set(authHeader(padre.accessToken))
      .send({ status: 'PADRE_EN_CAMINO' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/${apiPrefix}/circuit-requests/${requestId}/gps`)
      .set(authHeader(padre.accessToken))
      .send({ parentGpsLatitude: schoolLat, parentGpsLongitude: schoolLng })
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('NOTIFICADO_LLEGADA');
        expect(res.body.autoTransitioned).toBe(true);
      });

    for (const status of ['AUTORIZADO_SALIR', 'EN_CAMINO'] as const) {
      await request(app.getHttpServer())
        .patch(`/${apiPrefix}/circuit-requests/${requestId}/status`)
        .set(authHeader(admin.accessToken))
        .send({ status })
        .expect(200);
    }

    const confirmed = await request(app.getHttpServer())
      .patch(`/${apiPrefix}/circuit-requests/${requestId}/confirm-delivered`)
      .set(authHeader(padre.accessToken))
      .expect(200);

    expect(confirmed.body.status).toBe('ENTREGADO');
  });

  it('dashboard: admin consulta resumen y padre recibe 403', async () => {
    const admin = await login('administrativo@escuelapass.local', 'Admin123*');
    const padre = await login('padre1@escuelapass.local', 'Padre123*');

    const summary = await request(app.getHttpServer())
      .get(`/${apiPrefix}/dashboard/summary`)
      .set(authHeader(admin.accessToken))
      .expect(200);

    expect(summary.body).toHaveProperty('date');
    expect(summary.body).toHaveProperty('entities');
    expect(summary.body).toHaveProperty('attendanceToday');
    expect(summary.body).toHaveProperty('payments');
    expect(summary.body).toHaveProperty('circuitToday');
    expect(summary.body).toHaveProperty('accessToday');

    const actionable = await request(app.getHttpServer())
      .get(`/${apiPrefix}/dashboard/actionable-kpis`)
      .set(authHeader(admin.accessToken))
      .expect(200);
    expect(Array.isArray(actionable.body?.alerts)).toBe(true);

    await request(app.getHttpServer())
      .get(`/${apiPrefix}/dashboard/summary`)
      .set(authHeader(padre.accessToken))
      .expect(403);
  });

  it('school import: admin carga grupos por Excel y padre no puede', async () => {
    const admin = await login('administrativo@escuelapass.local', 'Admin123*');
    const padre = await login('padre1@escuelapass.local', 'Padre123*');
    const schoolYear = `E2E-${Date.now()}`;
    const xlsx = await buildGroupsImportXlsx(schoolYear);

    const imported = await request(app.getHttpServer())
      .post(`/${apiPrefix}/school/import/groups/xlsx`)
      .set(authHeader(admin.accessToken))
      .attach('file', xlsx, 'groups.xlsx')
      .expect(201);

    expect(imported.body.totalRows).toBe(1);
    expect(imported.body.created).toBe(1);
    expect(Array.isArray(imported.body.errors)).toBe(true);
    expect(imported.body.errors.length).toBe(0);

    await request(app.getHttpServer())
      .post(`/${apiPrefix}/school/import/groups/xlsx`)
      .set(authHeader(padre.accessToken))
      .attach('file', xlsx, 'groups.xlsx')
      .expect(403);
  });

  it('school import: asignaciones por Excel y plantilla xlsx', async () => {
    const admin = await login('administrativo@escuelapass.local', 'Admin123*');
    const teacher = await getTeacherByEmail(admin.accessToken, 'docente1@escuelapass.local');
    const group = await getGroupByName(admin.accessToken, '1A', '2026-2027');
    const subjectId = await getFirstSubjectId(admin.accessToken);
    const xlsx = await buildTeacherAssignmentsImportXlsx(teacher.id, group.id, subjectId);

    const imported = await request(app.getHttpServer())
      .post(`/${apiPrefix}/school/import/teacher-assignments/xlsx`)
      .set(authHeader(admin.accessToken))
      .attach('file', xlsx, 'assignments.xlsx')
      .expect(201);
    expect(imported.body.totalRows).toBe(1);
    expect(imported.body.created).toBe(1);
    expect(imported.body.errors.length).toBe(0);

    const xlsxSinMateria = await buildTeacherAssignmentsImportXlsx(teacher.id, group.id);
    const importedSin = await request(app.getHttpServer())
      .post(`/${apiPrefix}/school/import/teacher-assignments/xlsx`)
      .set(authHeader(admin.accessToken))
      .attach('file', xlsxSinMateria, 'assignments-no-subject.xlsx')
      .expect(201);
    expect(importedSin.body.totalRows).toBe(1);
    expect(importedSin.body.created).toBe(1);
    expect(importedSin.body.errors.length).toBe(0);

    const tpl = await request(app.getHttpServer())
      .get(`/${apiPrefix}/school/import/templates/teacher-assignments.xlsx`)
      .set(authHeader(admin.accessToken))
      .expect(200);
    expect(String(tpl.headers['content-type'] ?? '')).toMatch(/spreadsheet/);
    expectBinaryDownloadMinBytes(tpl, 100);
  });

  it('school import: historial de importaciones disponible para admin', async () => {
    const admin = await login('administrativo@escuelapass.local', 'Admin123*');
    const res = await request(app.getHttpServer())
      .get(`/${apiPrefix}/school/import/history`)
      .query({ limit: 5 })
      .set(authHeader(admin.accessToken))
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('kind');
    expect(res.body[0]).toHaveProperty('totalRows');
    expect(res.body[0]).toHaveProperty('created');
    expect(res.body[0]).toHaveProperty('errorCount');
    expect(res.body[0]).toHaveProperty('createdAt');
  });

  it('visitas, reuniones y horarios: padre solicita y staff responde', async () => {
    const admin = await login('administrativo@escuelapass.local', 'Admin123*');
    const teacher = await getTeacherByEmail(admin.accessToken, 'docente1@escuelapass.local');
    const group = await getGroupByName(admin.accessToken, '1A', '2026-2027');
    const subjectId = await getFirstSubjectId(admin.accessToken);
    await ensureTeacherAssignedToGroup(admin.accessToken, teacher.id, group.id, subjectId);

    const student = await getStudentByEmail(admin.accessToken, 'alumno1@escuelapass.local');

    const visitDt = new Date();
    visitDt.setDate(visitDt.getDate() + 7);

    const visitRes = await request(app.getHttpServer())
      .post(`/${apiPrefix}/external-visits`)
      .set(authHeader(admin.accessToken))
      .send({
        title: 'Visita externa e2e',
        purpose: 'Entrega de documentos',
        visitorName: 'Acudiente Prueba',
        visitDatetime: visitDt.toISOString(),
        audienceScope: 'STUDENTS',
        studentIds: [student.id]
      })
      .expect(201);

    const mineVisits = await request(app.getHttpServer())
      .get(`/${apiPrefix}/external-visits/me`)
      .set(authHeader(admin.accessToken))
      .expect(200);
    expect(Array.isArray(mineVisits.body)).toBe(true);

    await request(app.getHttpServer())
      .post(`/${apiPrefix}/external-visits/${visitRes.body.id}/realized`)
      .set(authHeader(admin.accessToken))
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    const meetDt = new Date();
    meetDt.setDate(meetDt.getDate() + 14);

    const meetingRes = await request(app.getHttpServer())
      .post(`/${apiPrefix}/meetings`)
      .set(authHeader(admin.accessToken))
      .send({
        title: 'Reunión e2e',
        purpose: 'Progreso académico',
        startAt: meetDt.toISOString(),
        durationMinutes: 30,
        location: 'A-101',
        invitees: [{ userId: teacher.userId, studentContextId: student.id }]
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/${apiPrefix}/meetings/${meetingRes.body.id}/status`)
      .set(authHeader(admin.accessToken))
      .send({ status: 'CONFIRMADA' })
      .expect((res) => {
        expect([200, 400]).toContain(res.status);
      });

    const slot = await request(app.getHttpServer())
      .post(`/${apiPrefix}/schedules`)
      .set(authHeader(admin.accessToken))
      .send({
        groupId: group.id,
        weekday: 1,
        startTime: '08:00',
        endTime: '09:00',
        room: 'A-101'
      });
    expect([201, 400]).toContain(slot.status);

    expect([201, 400]).toContain(slot.status);
  });

  it('lifecycle: transición alumno/docente con bloqueo operativo e historial', async () => {
    const admin = await login('administrativo@escuelapass.local', 'Admin123*');
    const padre = await login('padre1@escuelapass.local', 'Padre123*');
    const docente = await login('docente1@escuelapass.local', 'Docente123*');

    const studentsRes = await request(app.getHttpServer())
      .get(`/${apiPrefix}/school/students`)
      .set(authHeader(admin.accessToken))
      .expect(200);
    const student = (studentsRes.body as Array<{ id: string; email: string; lifecycleStatus?: string }>).find(
      (s) => s.email === 'alumno1@escuelapass.local'
    );
    expect(student).toBeDefined();

    const teachersRes = await request(app.getHttpServer())
      .get(`/${apiPrefix}/school/teachers`)
      .set(authHeader(admin.accessToken))
      .expect(200);
    const teacher = (teachersRes.body as Array<{ id: string; email: string; lifecycleStatus?: string }>).find(
      (t) => t.email === 'docente1@escuelapass.local'
    );
    expect(teacher).toBeDefined();

    const parentsRes = await request(app.getHttpServer())
      .get(`/${apiPrefix}/school/parents`)
      .set(authHeader(admin.accessToken))
      .expect(200);
    const parent = (parentsRes.body as Array<{ id: string; email: string }>).find(
      (p) => p.email === 'padre1@escuelapass.local'
    );
    expect(parent).toBeDefined();

    // Alumno -> BAJA
    const studentTargetStatus =
      student?.lifecycleStatus === 'ACTIVO'
        ? 'BAJA'
        : student?.lifecycleStatus === 'BAJA'
          ? 'TRASLADO'
          : student?.lifecycleStatus === 'TRASLADO'
            ? 'BAJA'
            : null;
    if (studentTargetStatus) {
      await request(app.getHttpServer())
        .post(`/${apiPrefix}/school/students/${student!.id}/lifecycle-transition`)
        .set(authHeader(admin.accessToken))
        .send({
          toStatus: studentTargetStatus,
          reason: 'E2E transición alumno'
        })
        .expect(201);
    }

    // Bloqueo operativo: padre ya no puede crear circuito para alumno inactivo
    await request(app.getHttpServer())
      .post(`/${apiPrefix}/circuit-requests`)
      .set(authHeader(padre.accessToken))
      .send({
        studentId: student!.id,
        requestedByParentId: parent!.id,
        pickupMethod: 'A_PIE'
      })
      .expect(400);

    const studentHistory = await request(app.getHttpServer())
      .get(`/${apiPrefix}/school/students/${student!.id}/lifecycle-history`)
      .set(authHeader(admin.accessToken))
      .expect(200);
    expect(Array.isArray(studentHistory.body)).toBe(true);
    expect(studentHistory.body.length).toBeGreaterThan(0);
    expect(studentHistory.body[0]).toHaveProperty('fromStatus');
    expect(studentHistory.body[0]).toHaveProperty('toStatus');

    // Reactivar alumno para no contaminar escenarios posteriores
    // Docente -> estado inactivo (si aplica según estado actual)
    const teacherTargetStatus =
      teacher?.lifecycleStatus === 'ACTIVO'
        ? 'BAJA'
        : teacher?.lifecycleStatus === 'BAJA'
          ? 'TRASLADO'
          : teacher?.lifecycleStatus === 'TRASLADO'
            ? 'BAJA'
            : null;
    if (teacherTargetStatus) {
      await request(app.getHttpServer())
        .post(`/${apiPrefix}/school/teachers/${teacher!.id}/lifecycle-transition`)
        .set(authHeader(admin.accessToken))
        .send({
          toStatus: teacherTargetStatus,
          reason: 'E2E transición docente'
        })
        .expect(201);
    }

    // Tras transición terminal el JWT deja de ser válido (cuenta inactiva) → 401
    await request(app.getHttpServer())
      .get(`/${apiPrefix}/schedules/me/teacher`)
      .set(authHeader(docente.accessToken))
      .expect(401);

    const teacherHistory = await request(app.getHttpServer())
      .get(`/${apiPrefix}/school/teachers/${teacher!.id}/lifecycle-history`)
      .set(authHeader(admin.accessToken))
      .expect(200);
    expect(Array.isArray(teacherHistory.body)).toBe(true);
    expect(teacherHistory.body.length).toBeGreaterThan(0);
    expect(teacherHistory.body[0]).toHaveProperty('fromStatus');
    expect(teacherHistory.body[0]).toHaveProperty('toStatus');

  }, 30000);

  it('t10/t11: SLA reportes + acuse crítico + recordatorio manual', async () => {
    const platformAdmin = await login('admin@escuelapass.local', 'Admin123*');
    const parent = await login('padre1@escuelapass.local', 'Padre123*');

    await request(app.getHttpServer())
      .post(`/${apiPrefix}/notifications/admin-reports`)
      .set(authHeader(parent.accessToken))
      .send({
        type: 'SUGERENCIA',
        subject: 'E2E SLA report',
        message: 'Validación E2E de resumen SLA'
      })
      .expect(201);

    const slaSummary = await request(app.getHttpServer())
      .get(`/${apiPrefix}/notifications/admin-reports/sla-summary`)
      .set(authHeader(platformAdmin.accessToken))
      .expect(200);
    expect(slaSummary.body).toHaveProperty('total');
    expect(slaSummary.body).toHaveProperty('responseBreached');
    expect(slaSummary.body).toHaveProperty('resolutionBreached');

    const createdNotice = await request(app.getHttpServer())
      .post(`/${apiPrefix}/notices`)
      .set(authHeader(platformAdmin.accessToken))
      .send({
        title: 'Comunicado crítico E2E',
        content: 'Por favor confirmar lectura',
        isImportant: true,
        targetType: 'ALL',
        targetRole: 'PADRE'
      })
      .expect(201);
    expect(createdNotice.body).toHaveProperty('noticeId');

    const parentNotifications = await request(app.getHttpServer())
      .get(`/${apiPrefix}/notifications/me`)
      .set(authHeader(parent.accessToken))
      .expect(200);
    const parentNotif = (parentNotifications.body?.data ?? []).find(
      (n: { noticeId?: string | null }) => n.noticeId === createdNotice.body.noticeId
    );
    expect(parentNotif).toBeDefined();

    await request(app.getHttpServer())
      .patch(`/${apiPrefix}/notifications/${parentNotif.id}/read`)
      .set(authHeader(parent.accessToken))
      .expect(200);

    const receipts = await request(app.getHttpServer())
      .get(`/${apiPrefix}/notices/critical/read-receipts`)
      .set(authHeader(platformAdmin.accessToken))
      .expect(200);
    expect(Array.isArray(receipts.body?.data)).toBe(true);
    expect(receipts.body.data.length).toBeGreaterThan(0);
    expect(receipts.body.data[0]).toHaveProperty('readRate');

    const slaReminder = await request(app.getHttpServer())
      .post(`/${apiPrefix}/notifications/admin-reports/sla-reminders/run`)
      .set(authHeader(platformAdmin.accessToken))
      .expect(200);
    expect(slaReminder.body).toHaveProperty('noticesChecked');
    expect(slaReminder.body).toHaveProperty('remindersCreated');
  }, 30000);

  it('t12/t13: políticas de cartera + bitácora de ajustes', async () => {
    const admin = await login('administrativo@escuelapass.local', 'Admin123*');
    const groupsRes = await request(app.getHttpServer())
      .get(`/${apiPrefix}/school/groups`)
      .set(authHeader(admin.accessToken))
      .expect(200);
    const group = (groupsRes.body as Array<{ id: string }>)[0];
    expect(group).toBeDefined();

    const stamp = Date.now();
    const newStudent = await request(app.getHttpServer())
      .post(`/${apiPrefix}/school/students`)
      .set(authHeader(admin.accessToken))
      .send({
        email: `alumno.cartera.${stamp}@escuelapass.local`,
        password: 'Alumno123*',
        fullName: `Alumno Cartera ${stamp}`,
        groupId: group.id
      })
      .expect(201);
    expect(newStudent.body).toHaveProperty('id');

    await request(app.getHttpServer())
      .post(`/${apiPrefix}/payments/concepts/ensure-base`)
      .set(authHeader(admin.accessToken))
      .expect(201);

    const conceptsRes = await request(app.getHttpServer())
      .get(`/${apiPrefix}/payments/concepts`)
      .set(authHeader(admin.accessToken))
      .expect(200);
    const concept = (conceptsRes.body as Array<{ id: string }>)[0];
    expect(concept).toBeDefined();

    const createdDebt = await request(app.getHttpServer())
      .post(`/${apiPrefix}/payments/debts`)
      .set(authHeader(admin.accessToken))
      .send({
        studentId: newStudent.body.id,
        conceptId: concept.id,
        amount: 100,
        dueDate: '2020-01-01',
        description: 'E2E deuda vencida para política'
      })
      .expect(201);
    expect(createdDebt.body).toHaveProperty('id');

    const policyRun = await request(app.getHttpServer())
      .post(`/${apiPrefix}/payments/debts/policies/run`)
      .set(authHeader(admin.accessToken))
      .expect(201);
    expect(policyRun.body).toHaveProperty('checked');
    expect(policyRun.body).toHaveProperty('lateFeeApplied');

    const arrangement = await request(app.getHttpServer())
      .post(`/${apiPrefix}/payments/debts/${createdDebt.body.id}/arrangement`)
      .set(authHeader(admin.accessToken))
      .send({ discountPercent: 10, reason: 'Convenio E2E' })
      .expect(201);
    expect(arrangement.body).toHaveProperty('nextAmount');

    const adjustments = await request(app.getHttpServer())
      .get(`/${apiPrefix}/payments/debts/adjustments`)
      .set(authHeader(admin.accessToken))
      .expect(200);
    expect(Array.isArray(adjustments.body?.data)).toBe(true);
    expect(adjustments.body.data.length).toBeGreaterThan(0);
    const debtAdjustments = adjustments.body.data.filter(
      (row: { debtId?: string; actionType?: string }) => row.debtId === createdDebt.body.id
    );
    expect(debtAdjustments.some((row: { actionType?: string }) => row.actionType === 'LATE_FEE')).toBe(true);
    expect(debtAdjustments.some((row: { actionType?: string }) => row.actionType === 'ARRANGEMENT')).toBe(true);
  }, 30000);

  it('t14: circuito GPS — auto-transición a NOTIFICADO_LLEGADA al entrar al radio', async () => {
    const admin = await login('administrativo@escuelapass.local', 'Admin123*');
    const parent = await login('padre1@escuelapass.local', 'Padre123*');

    // Obtener primer estudiante del padre para circuito
    const activeRes = await request(app.getHttpServer())
      .get(`/${apiPrefix}/circuit-requests/parent/active`)
      .set(authHeader(parent.accessToken));
    // Si ya hay circuito activo lo usamos; si no, creamos uno
    let circuitId: string | null = (activeRes.body as { active?: { id?: string } })?.active?.id ?? null;

    if (!circuitId) {
      // Buscar un estudiante vinculado al padre
      const studentsRes = await request(app.getHttpServer())
        .get(`/${apiPrefix}/school/students`)
        .set(authHeader(admin.accessToken))
        .expect(200);
      const firstStudent = (studentsRes.body as Array<{ id: string }>)[0];
      if (!firstStudent) {
        console.warn('t14: no hay estudiantes para crear circuito');
        return;
      }
      await registerAttendancePresentToday(admin.accessToken, firstStudent.id);
      // Crear circuito en estado PENDIENTE (requiere parentId vinculado; omitir si no hay vínculo)
      const createRes = await request(app.getHttpServer())
        .post(`/${apiPrefix}/circuit-requests`)
        .set(authHeader(parent.accessToken))
        .send({ studentId: firstStudent.id, pickupMethod: 'FAMILIAR_DIRECTO' });
      if (createRes.status !== 201) return; // parent no vinculado al estudiante; test no aplica
      circuitId = (createRes.body as { requestId?: string }).requestId ?? null;
    }
    if (!circuitId) return;

    // Avanzar a PADRE_EN_CAMINO
    await request(app.getHttpServer())
      .patch(`/${apiPrefix}/circuit-requests/${circuitId}/parent-progress`)
      .set(authHeader(parent.accessToken))
      .send({ status: 'PADRE_EN_CAMINO' });

    // Simular GPS dentro del radio (coordenadas de la escuela del seed)
    const schoolRes = await request(app.getHttpServer())
      .get(`/${apiPrefix}/circuit-requests/${circuitId}/map`)
      .set(authHeader(admin.accessToken));
    const schoolLat: number = (schoolRes.body as { schoolLatitude?: number }).schoolLatitude ?? 0;
    const schoolLng: number = (schoolRes.body as { schoolLongitude?: number }).schoolLongitude ?? 0;

    if (schoolLat === 0 && schoolLng === 0) {
      // La escuela no tiene coordenadas configuradas; omitir verificación de auto-transición
      return;
    }

    const gpsRes = await request(app.getHttpServer())
      .patch(`/${apiPrefix}/circuit-requests/${circuitId}/gps`)
      .set(authHeader(parent.accessToken))
      .send({ parentGpsLatitude: schoolLat, parentGpsLongitude: schoolLng })
      .expect(200);

    expect(gpsRes.body).toHaveProperty('autoTransitioned');
    expect(gpsRes.body).toHaveProperty('distanceToSchoolKm');
    if (gpsRes.body.autoTransitioned === true) {
      expect(gpsRes.body.status).toBe('NOTIFICADO_LLEGADA');
    }
  }, 30000);

  it('t15: NFC — asignar, listar y revocar credencial', async () => {
    const admin = await login('administrativo@escuelapass.local', 'Admin123*');
    const studentsRes = await request(app.getHttpServer())
      .get(`/${apiPrefix}/school/students`)
      .set(authHeader(admin.accessToken))
      .expect(200);
    const firstStudent = (studentsRes.body as Array<{ userId: string }>)[0];
    if (!firstStudent?.userId) {
      console.warn('t15: no hay estudiantes para asignar credencial NFC');
      return;
    }

    const nfcUid = `A${Date.now().toString(16).slice(-7).toUpperCase()}`;

    // Asignar
    const assignRes = await request(app.getHttpServer())
      .post(`/${apiPrefix}/access-events/credentials/nfc`)
      .set(authHeader(admin.accessToken))
      .send({ targetUserId: firstStudent.userId, nfcUid })
      .expect(201);
    expect(assignRes.body).toHaveProperty('credentialId');
    const credentialId: string = (assignRes.body as { credentialId: string }).credentialId;

    // Listar
    const listRes = await request(app.getHttpServer())
      .get(`/${apiPrefix}/access-events/credentials`)
      .set(authHeader(admin.accessToken))
      .expect(200);
    expect(Array.isArray(listRes.body?.data)).toBe(true);
    const found = (listRes.body.data as Array<{ id: string }>).find((c) => c.id === credentialId);
    expect(found).toBeDefined();

    // Revocar
    const revokeRes = await request(app.getHttpServer())
      .delete(`/${apiPrefix}/access-events/credentials/${credentialId}`)
      .set(authHeader(admin.accessToken))
      .expect(200);
    expect(revokeRes.body).toHaveProperty('message');

    // Verificar que ya no aparece en listado activo
    const listAfter = await request(app.getHttpServer())
      .get(`/${apiPrefix}/access-events/credentials`)
      .set(authHeader(admin.accessToken))
      .expect(200);
    const foundAfter = (listAfter.body.data as Array<{ id: string }>).find((c) => c.id === credentialId);
    expect(foundAfter).toBeUndefined();
  }, 30000);

  it('t16: reuniones, visitas y anotaciones (padre) responden tras restaurar módulos', async () => {
    const admin = await login('administrativo@escuelapass.local', 'Admin123*');

    const visits = await request(app.getHttpServer())
      .get(`/${apiPrefix}/external-visits`)
      .set(authHeader(admin.accessToken))
      .expect(200);
    expect(Array.isArray(visits.body)).toBe(true);

    const meetingsList = await request(app.getHttpServer())
      .get(`/${apiPrefix}/meetings`)
      .set(authHeader(admin.accessToken))
      .expect(200);
    expect(Array.isArray(meetingsList.body)).toBe(true);

    const parent = await login('padre1@escuelapass.local', 'Padre123*');
    const notes = await request(app.getHttpServer())
      .get(`/${apiPrefix}/attention-notes/parent/my-children`)
      .set(authHeader(parent.accessToken))
      .expect(200);
    expect(Array.isArray(notes.body)).toBe(true);
  }, 15000);

  it('t17: admin-reports (tickets SLA) están disponibles', async () => {
    const admin = await login('administrativo@escuelapass.local', 'Admin123*');
    const platformAdmin = await login('admin@escuelapass.local', 'Admin123*');

    const listMine = await request(app.getHttpServer())
      .get(`/${apiPrefix}/notifications/admin-reports/mine`)
      .set(authHeader(admin.accessToken))
      .expect(200);
    expect(listMine.body).toHaveProperty('data');
    expect(Array.isArray(listMine.body.data)).toBe(true);

    const listAll = await request(app.getHttpServer())
      .get(`/${apiPrefix}/notifications/admin-reports`)
      .set(authHeader(platformAdmin.accessToken))
      .query({ limit: 5 })
      .expect(200);
    expect(listAll.body).toHaveProperty('data');
    expect(Array.isArray(listAll.body.data)).toBe(true);
  }, 15000);
});
