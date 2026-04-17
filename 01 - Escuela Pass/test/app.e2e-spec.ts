import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import ExcelJS from 'exceljs';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';

async function buildGroupsImportXlsx(schoolYear: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Grupos');
  ws.addRow(['name', 'grade', 'shift', 'schoolYear', 'classroom', 'capacity']);
  ws.addRow(['E2E-GRUPO', '1', 'MATUTINO', schoolYear, 'A-1', '25']);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
}

async function buildTeacherAssignmentsImportXlsx(
  teacherId: string,
  groupId: string
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Asignaciones');
  ws.addRow([
    'teacherId',
    'groupId',
    'subjectId',
    'isMainTeacher',
    'canAuthorizeDepartures'
  ]);
  ws.addRow([teacherId, groupId, '', 'true', 'true']);
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
    const first = await login('admin@escuelapass.local', 'Admin123*');

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

    const student = await sqlOne<{ id: string }>(
      `SELECT s.id
       FROM students s
       INNER JOIN users u ON u.id = s.user_id
       WHERE u.email = $1`,
      ['alumno1@escuelapass.local']
    );

    const date = new Date().toISOString().slice(0, 10);

    const first = await request(app.getHttpServer())
      .post(`/${apiPrefix}/attendance/register`)
      .set(authHeader(admin.accessToken))
      .send({ studentId: student.id, status: 'PRESENTE', attendanceDate: date, notes: 'e2e' })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post(`/${apiPrefix}/attendance/register`)
      .set(authHeader(admin.accessToken))
      .send({ studentId: student.id, status: 'RETARDO', attendanceDate: date, notes: 'e2e2' })
      .expect(201);

    expect(second.body.id).toBe(first.body.id);
    expect(second.body.status).toBe('RETARDO');
  });

  it('calendario: día sin clases bloquea registro de asistencia y export Excel', async () => {
    const admin = await login('admin@escuelapass.local', 'Admin123*');

    const student = await sqlOne<{ id: string; group_id: string | null }>(
      `SELECT s.id, s.group_id
       FROM students s
       INNER JOIN users u ON u.id = s.user_id
       WHERE u.email = $1`,
      ['alumno1@escuelapass.local']
    );

    const date = new Date().toISOString().slice(0, 10);

    const created = await request(app.getHttpServer())
      .post(`/${apiPrefix}/calendar/non-instructional-days`)
      .set(authHeader(admin.accessToken))
      .send({ exceptionDate: date, reason: 'e2e calendario' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/${apiPrefix}/attendance/register`)
      .set(authHeader(admin.accessToken))
      .send({ studentId: student.id, status: 'PRESENTE', attendanceDate: date })
      .expect(400);

    if (student.group_id) {
      await request(app.getHttpServer())
        .get(`/${apiPrefix}/exports/attendance.xlsx`)
        .query({ groupId: student.group_id, date })
        .set(authHeader(admin.accessToken))
        .expect(400);
    }

    await request(app.getHttpServer())
      .delete(`/${apiPrefix}/calendar/non-instructional-days/${created.body.id}`)
      .set(authHeader(admin.accessToken))
      .expect(200);

    await request(app.getHttpServer())
      .post(`/${apiPrefix}/attendance/register`)
      .set(authHeader(admin.accessToken))
      .send({ studentId: student.id, status: 'PRESENTE', attendanceDate: date, notes: 'post-cal' })
      .expect(201);
  });

  it('access scan: ENTRY de alumno por QR marca asistencia automatica', async () => {
    const admin = await login('admin@escuelapass.local', 'Admin123*');

    const student = await sqlOne<{ id: string; user_id: string }>(
      `SELECT s.id, s.user_id
       FROM students s
       INNER JOIN users u ON u.id = s.user_id
       WHERE u.email = $1`,
      ['alumno1@escuelapass.local']
    );

    const date = new Date().toISOString().slice(0, 10);
    await db.query(
      `DELETE FROM access_events
       WHERE user_id = $1
         AND event_date = $2
         AND event_type = 'ENTRY'`,
      [student.user_id, date]
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

    const attendance = await sqlOne<{ status: string; notes: string | null }>(
      `SELECT status::text AS status, notes
       FROM attendance_records
       WHERE student_id = $1
         AND attendance_date = $2`,
      [student.id, date]
    );
    expect(attendance.status).toBe('PRESENTE');
    expect(attendance.notes ?? '').toContain('AUTO_ACCESS_SCAN:QR:ENTRY');
  });

  it('grades: docente registra y padre puede leer', async () => {
    // Preparar asignación docente -> grupo (si falta)
    const teacher = await sqlOne<{ teacher_id: string }>(
      `SELECT t.id AS teacher_id
       FROM teachers t
       INNER JOIN users u ON u.id = t.user_id
       WHERE u.email = $1`,
      ['docente1@escuelapass.local']
    );
    const group = await sqlOne<{ group_id: string }>(
      `SELECT g.id AS group_id
       FROM groups g
       WHERE g.name = '1A' AND g.school_year = '2026-2027'`
    );
    await db.query(
      `INSERT INTO teacher_groups (teacher_id, group_id)
       SELECT $1::uuid, $2::uuid
       WHERE NOT EXISTS (
         SELECT 1 FROM teacher_groups tg WHERE tg.teacher_id = $1::uuid AND tg.group_id = $2::uuid
       )`,
      [teacher.teacher_id, group.group_id]
    );

    const student = await sqlOne<{ id: string }>(
      `SELECT s.id
       FROM students s
       INNER JOIN users u ON u.id = s.user_id
       WHERE u.email = $1`,
      ['alumno1@escuelapass.local']
    );

    const docente = await login('docente1@escuelapass.local', 'Docente123*');

    await request(app.getHttpServer())
      .post(`/${apiPrefix}/grades/register`)
      .set(authHeader(docente.accessToken))
      .send({
        studentId: student.id,
        subject: 'Matematicas',
        period: 'BIM1-2026',
        assessmentName: 'Parcial 1',
        score: 18.5,
        maxScore: 20,
        notes: 'e2e'
      })
      .expect(201);

    const padre = await login('padre1@escuelapass.local', 'Padre123*');
    const res = await request(app.getHttpServer())
      .get(`/${apiPrefix}/grades/student/${student.id}`)
      .set(authHeader(padre.accessToken))
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('circuit + reports: circuito hoy y reportes responden', async () => {
    const admin = await login('admin@escuelapass.local', 'Admin123*');
    const padre = await login('padre1@escuelapass.local', 'Padre123*');

    const parent = await sqlOne<{ parent_id: string }>(
      `SELECT p.id AS parent_id
       FROM parents p
       INNER JOIN users u ON u.id = p.user_id
       WHERE u.email = $1`,
      ['padre1@escuelapass.local']
    );
    const student = await sqlOne<{ id: string; group_id: string }>(
      `SELECT s.id, s.group_id
       FROM students s
       INNER JOIN users u ON u.id = s.user_id
       WHERE u.email = $1`,
      ['alumno1@escuelapass.local']
    );

    // padre crea solicitud circuito
    const created = await request(app.getHttpServer())
      .post(`/${apiPrefix}/circuit-requests`)
      .set(authHeader(padre.accessToken))
      .send({
        studentId: student.id,
        requestedByParentId: parent.parent_id,
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
      .query({ groupId: student.group_id })
      .set(authHeader(admin.accessToken))
      .expect(200);

    expect(created.body.requestId).toBeDefined();
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
    const admin = await login('admin@escuelapass.local', 'Admin123*');

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
    const admin = await login('admin@escuelapass.local', 'Admin123*');
    const res = await request(app.getHttpServer())
      .get(`/${apiPrefix}/school/groups`)
      .set(authHeader(admin.accessToken))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('exports: Excel asistencia, calificaciones y boletín consolidado', async () => {
    const admin = await login('admin@escuelapass.local', 'Admin123*');
    const group = await sqlOne<{ group_id: string }>(
      `SELECT g.id AS group_id FROM groups g WHERE g.name = '1A' AND g.school_year = '2026-2027'`
    );
    const date = new Date().toISOString().slice(0, 10);

    const attX = await request(app.getHttpServer())
      .get(`/${apiPrefix}/exports/attendance.xlsx`)
      .query({ groupId: group.group_id, date })
      .set(authHeader(admin.accessToken))
      .expect(200);
    expect(String(attX.headers['content-type'] ?? '')).toMatch(/spreadsheet/);
    expectBinaryDownloadMinBytes(attX, 200);

    const grX = await request(app.getHttpServer())
      .get(`/${apiPrefix}/exports/grades.xlsx`)
      .query({ groupId: group.group_id })
      .set(authHeader(admin.accessToken))
      .expect(200);
    expect(String(grX.headers['content-type'] ?? '')).toMatch(/spreadsheet/);
    expectBinaryDownloadMinBytes(grX, 200);

    const bull = await request(app.getHttpServer())
      .get(`/${apiPrefix}/exports/bulletin-consolidated.xlsx`)
      .query({ groupId: group.group_id })
      .set(authHeader(admin.accessToken))
      .expect(200);
    expect(String(bull.headers['content-type'] ?? '')).toMatch(/spreadsheet/);
    expectBinaryDownloadMinBytes(bull, 200);
  });

  it('settings: perfil institucional lectura y actualización admin', async () => {
    const admin = await login('admin@escuelapass.local', 'Admin123*');
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
    const admin = await login('admin@escuelapass.local', 'Admin123*');
    const padre = await login('padre1@escuelapass.local', 'Padre123*');

    const parent = await sqlOne<{ parent_id: string }>(
      `SELECT p.id AS parent_id
       FROM parents p
       INNER JOIN users u ON u.id = p.user_id
       WHERE u.email = $1`,
      ['padre1@escuelapass.local']
    );
    const student = await sqlOne<{ id: string }>(
      `SELECT s.id
       FROM students s
       INNER JOIN users u ON u.id = s.user_id
       WHERE u.email = $1`,
      ['alumno1@escuelapass.local']
    );

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
        requestedByParentId: parent.parent_id,
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
    const padre = await login('padre1@escuelapass.local', 'Padre123*');
    const parent = await sqlOne<{ parent_id: string }>(
      `SELECT p.id AS parent_id
       FROM parents p
       INNER JOIN users u ON u.id = p.user_id
       WHERE u.email = $1`,
      ['padre1@escuelapass.local']
    );
    const student = await sqlOne<{ id: string }>(
      `SELECT s.id
       FROM students s
       INNER JOIN users u ON u.id = s.user_id
       WHERE u.email = $1`,
      ['alumno1@escuelapass.local']
    );

    const created = await request(app.getHttpServer())
      .post(`/${apiPrefix}/circuit-requests`)
      .set(authHeader(padre.accessToken))
      .send({
        studentId: student.id,
        requestedByParentId: parent.parent_id,
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
    const admin = await login('admin@escuelapass.local', 'Admin123*');
    const parent = await sqlOne<{ parent_id: string }>(
      `SELECT p.id AS parent_id
       FROM parents p
       INNER JOIN users u ON u.id = p.user_id
       WHERE u.email = $1`,
      ['padre1@escuelapass.local']
    );
    const student = await sqlOne<{ id: string }>(
      `SELECT s.id
       FROM students s
       INNER JOIN users u ON u.id = s.user_id
       WHERE u.email = $1`,
      ['alumno1@escuelapass.local']
    );

    const created = await request(app.getHttpServer())
      .post(`/${apiPrefix}/circuit-requests`)
      .set(authHeader(padre.accessToken))
      .send({
        studentId: student.id,
        requestedByParentId: parent.parent_id,
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
    const admin = await login('admin@escuelapass.local', 'Admin123*');
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

    await request(app.getHttpServer())
      .get(`/${apiPrefix}/dashboard/summary`)
      .set(authHeader(padre.accessToken))
      .expect(403);
  });

  it('school import: admin carga grupos por Excel y padre no puede', async () => {
    const admin = await login('admin@escuelapass.local', 'Admin123*');
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
    const admin = await login('admin@escuelapass.local', 'Admin123*');
    const teacher = await sqlOne<{ teacher_id: string }>(
      `SELECT t.id AS teacher_id
       FROM teachers t
       INNER JOIN users u ON u.id = t.user_id
       WHERE u.email = $1`,
      ['docente1@escuelapass.local']
    );
    const group = await sqlOne<{ group_id: string }>(
      `SELECT g.id AS group_id
       FROM groups g
       WHERE g.name = '1A' AND g.school_year = '2026-2027'`
    );
    const xlsx = await buildTeacherAssignmentsImportXlsx(teacher.teacher_id, group.group_id);

    const imported = await request(app.getHttpServer())
      .post(`/${apiPrefix}/school/import/teacher-assignments/xlsx`)
      .set(authHeader(admin.accessToken))
      .attach('file', xlsx, 'assignments.xlsx')
      .expect(201);
    expect(imported.body.totalRows).toBe(1);
    expect(imported.body.created).toBe(1);
    expect(imported.body.errors.length).toBe(0);

    const tpl = await request(app.getHttpServer())
      .get(`/${apiPrefix}/school/import/templates/teacher-assignments.xlsx`)
      .set(authHeader(admin.accessToken))
      .expect(200);
    expect(String(tpl.headers['content-type'] ?? '')).toMatch(/spreadsheet/);
    expectBinaryDownloadMinBytes(tpl, 100);
  });

  it('school import: historial de importaciones disponible para admin', async () => {
    const admin = await login('admin@escuelapass.local', 'Admin123*');
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
    const teacher = await sqlOne<{ teacher_id: string }>(
      `SELECT t.id AS teacher_id
       FROM teachers t
       INNER JOIN users u ON u.id = t.user_id
       WHERE u.email = $1`,
      ['docente1@escuelapass.local']
    );
    const group = await sqlOne<{ group_id: string }>(
      `SELECT g.id AS group_id
       FROM groups g
       WHERE g.name = '1A' AND g.school_year = '2026-2027'`
    );
    await db.query(
      `INSERT INTO teacher_groups (teacher_id, group_id)
       SELECT $1::uuid, $2::uuid
       WHERE NOT EXISTS (
         SELECT 1 FROM teacher_groups tg WHERE tg.teacher_id = $1::uuid AND tg.group_id = $2::uuid
       )`,
      [teacher.teacher_id, group.group_id]
    );

    const student = await sqlOne<{ id: string }>(
      `SELECT s.id
       FROM students s
       INNER JOIN users u ON u.id = s.user_id
       WHERE u.email = $1`,
      ['alumno1@escuelapass.local']
    );

    const padre = await login('padre1@escuelapass.local', 'Padre123*');
    const admin = await login('admin@escuelapass.local', 'Admin123*');
    const docente = await login('docente1@escuelapass.local', 'Docente123*');

    const visitDt = new Date();
    visitDt.setDate(visitDt.getDate() + 7);

    const visitRes = await request(app.getHttpServer())
      .post(`/${apiPrefix}/visits`)
      .set(authHeader(padre.accessToken))
      .send({
        studentId: student.id,
        visitDatetime: visitDt.toISOString(),
        reason: 'Entrega de documentos'
      })
      .expect(201);

    const mineVisits = await request(app.getHttpServer())
      .get(`/${apiPrefix}/visits/me`)
      .set(authHeader(padre.accessToken))
      .expect(200);
    expect(Array.isArray(mineVisits.body)).toBe(true);
    expect(mineVisits.body.some((v: { id: string }) => v.id === visitRes.body.id)).toBe(true);

    await request(app.getHttpServer())
      .patch(`/${apiPrefix}/visits/${visitRes.body.id}/status`)
      .set(authHeader(admin.accessToken))
      .send({ status: 'APROBADA' })
      .expect(200);

    const meetDt = new Date();
    meetDt.setDate(meetDt.getDate() + 14);

    const meetingRes = await request(app.getHttpServer())
      .post(`/${apiPrefix}/meetings`)
      .set(authHeader(padre.accessToken))
      .send({
        teacherId: teacher.teacher_id,
        studentId: student.id,
        meetingDatetime: meetDt.toISOString(),
        topic: 'Progreso académico'
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/${apiPrefix}/meetings/${meetingRes.body.id}/status`)
      .set(authHeader(docente.accessToken))
      .send({ status: 'CONFIRMADA' })
      .expect(200);

    const slot = await request(app.getHttpServer())
      .post(`/${apiPrefix}/schedules`)
      .set(authHeader(admin.accessToken))
      .send({
        groupId: group.group_id,
        weekday: 1,
        startTime: '08:00',
        endTime: '09:00',
        room: 'A-101'
      })
      .expect(201);

    const sched = await request(app.getHttpServer())
      .get(`/${apiPrefix}/schedules/groups/${group.group_id}`)
      .set(authHeader(padre.accessToken))
      .expect(200);
    expect(Array.isArray(sched.body)).toBe(true);
    expect(sched.body.some((s: { id: string }) => s.id === slot.body.id)).toBe(true);
  });
});
