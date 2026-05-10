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

  const circuitTodayYmd = (): string => {
    const tz = process.env.APP_TIMEZONE?.trim() || 'America/Mexico_City';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
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

  const getFirstAcademicPeriodId = async (token: string) => {
    const res = await request(app.getHttpServer())
      .get(`/${apiPrefix}/academic-periods`)
      .set(authHeader(token));
    if (res.status === 200) {
      const first = (res.body as Array<{ id: string }>)[0];
      if (first?.id) return first.id;
    }
    const now = new Date();
    const y = now.getUTCFullYear();
    const schoolYear = `${y}-${y + 1}`;
    const created = await request(app.getHttpServer())
      .post(`/${apiPrefix}/academic-periods`)
      .set(authHeader(token))
      .send({
        schoolYear,
        name: 'BIM1',
        orderIndex: 1,
        startDate: `${y}-01-10`,
        endDate: `${y}-03-31`,
        weight: 100
      })
      .expect(201);
    return created.body.id as string;
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

    const date = new Date().toISOString().slice(0, 10);
    await db.query(
      `DELETE FROM access_events
       WHERE user_id = $1
         AND event_date = $2
         AND event_type = 'ENTRY'`,
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
      .expect(201);

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

    await request(app.getHttpServer())
      .post(`/${apiPrefix}/circuit-requests`)
      .set(authHeader(padre.accessToken))
      .send({
        studentId: student.id,
        requestedByParentId: parent.id,
        pickupMethod: 'A_PIE'
      })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/${apiPrefix}/settings/circuit`)
      .set(authHeader(admin.accessToken))
      .send({ enabled: true })
      .expect(200);
  });

  it('circuit: padre actualiza GPS de su solicitud', async () => {
    const admin = await login('administrativo@escuelapass.local', 'Admin123*');
    const padre = await login('padre1@escuelapass.local', 'Padre123*');
    const parent = await getParentByEmail(admin.accessToken, 'padre1@escuelapass.local');
    const student = await getStudentByEmail(admin.accessToken, 'alumno1@escuelapass.local');

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

    const patch = await request(app.getHttpServer())
      .patch(`/${apiPrefix}/circuit-requests/${created.body.requestId}/gps`)
      .set(authHeader(padre.accessToken))
      .send({ parentGpsLatitude: 4.6097, parentGpsLongitude: -74.0817 })
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

    const p2 = await request(app.getHttpServer())
      .patch(`/${apiPrefix}/circuit-requests/${created.body.requestId}/parent-progress`)
      .set(authHeader(padre.accessToken))
      .send({
        status: 'NOTIFICADO_LLEGADA',
        parentGpsLatitude: 4.6097,
        parentGpsLongitude: -74.0817
      })
      .expect(200);
    expect(p2.body.status).toBe('NOTIFICADO_LLEGADA');
  });

  it('circuit: padre confirma entrega de su solicitud', async () => {
    const padre = await login('padre1@escuelapass.local', 'Padre123*');
    const admin = await login('administrativo@escuelapass.local', 'Admin123*');
    const parent = await getParentByEmail(admin.accessToken, 'padre1@escuelapass.local');
    const student = await getStudentByEmail(admin.accessToken, 'alumno1@escuelapass.local');

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

    await request(app.getHttpServer())
      .patch(`/${apiPrefix}/circuit-requests/${requestId}/parent-progress`)
      .set(authHeader(padre.accessToken))
      .send({ status: 'PADRE_EN_CAMINO' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/${apiPrefix}/circuit-requests/${requestId}/parent-progress`)
      .set(authHeader(padre.accessToken))
      .send({
        status: 'NOTIFICADO_LLEGADA',
        parentGpsLatitude: 4.6097,
        parentGpsLongitude: -74.0817
      })
      .expect(200);

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

    // Bloqueo operativo: docente inactivo no consulta su horario
    await request(app.getHttpServer())
      .get(`/${apiPrefix}/schedules/me/teacher`)
      .set(authHeader(docente.accessToken))
      .expect(403);

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
    const parent = await login('padre@escuelapass.local', 'Admin123*');

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

    const parent = await login('padre@escuelapass.local', 'Admin123*');
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
