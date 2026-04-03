import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';

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
    // Hacemos determinística la regla de llegada por radio para esta suite:
    // con un radio muy amplio, cualquier GPS reportado debe entrar a "NOTIFICADO_LLEGADA".
    process.env.CIRCUIT_ARRIVAL_RADIUS_KM = '9999';

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

  it('exports: CSV asistencia y calificaciones (text/csv)', async () => {
    const admin = await login('admin@escuelapass.local', 'Admin123*');
    const group = await sqlOne<{ group_id: string }>(
      `SELECT g.id AS group_id FROM groups g WHERE g.name = '1A' AND g.school_year = '2026-2027'`
    );
    const date = new Date().toISOString().slice(0, 10);

    const att = await request(app.getHttpServer())
      .get(`/${apiPrefix}/exports/attendance.csv`)
      .query({ groupId: group.group_id, date })
      .set(authHeader(admin.accessToken))
      .expect(200);
    expect(String(att.headers['content-type'] ?? '')).toMatch(/text\/csv/);
    expect(att.text).toContain('matricula');

    const gr = await request(app.getHttpServer())
      .get(`/${apiPrefix}/exports/grades.csv`)
      .query({ groupId: group.group_id })
      .set(authHeader(admin.accessToken))
      .expect(200);
    expect(String(gr.headers['content-type'] ?? '')).toMatch(/text\/csv/);
    expect(gr.text).toContain('matricula');
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
    expect(patch.body.status).toBe('NOTIFICADO_LLEGADA');
    expect(patch.body.autoTransitioned).toBe(true);
    expect(typeof patch.body.distanceToSchoolKm).toBe('number');
    expect(['mapbox', 'haversine']).toContain(patch.body.distanceSource);
  });
});
