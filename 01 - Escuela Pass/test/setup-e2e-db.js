const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.e2e'), override: true });

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

/** URL postgres:// directa. Respeta .env.e2e si override. */
function directPostgresUrl() {
  const u = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!u) return null;
  if (u.startsWith('postgres://') || u.startsWith('postgresql://')) return u;
  return null;
}

/**
 * Conectar por DB_HOST/DB_USER/… aunque .env tenga DATABASE_URL (p. ej. Railway para Nest).
 * En `.env.e2e`: E2E_USE_DB_HOST=1 y las variables DB_* de la BD solo para pruebas.
 */
function shouldUseHostVarsForE2e() {
  const v = process.env.E2E_USE_DB_HOST;
  return v === '1' || v === 'true' || v === 'yes';
}

function sqlWithoutExtensionDeps(sql) {
  return sql
    .split(/\r?\n/)
    .filter((line) => !/^CREATE EXTENSION\b/i.test(line.trim()))
    .join('\n')
    .replace(/\buuid_generate_v4\s*\(\s*\)/gi, 'gen_random_uuid()');
}

function sqlWithoutConflictTargets(sql) {
  return sql.replace(/\bON\s+CONFLICT\s*\([^)]+\)\s*DO\s+NOTHING/gi, 'ON CONFLICT DO NOTHING');
}

/** Evita BOM UTF-8 en el primer byte (Postgres devuelve `syntax error at or near "`"). */
function readUtf8SqlNoBom(filePath) {
  const buf = fs.readFileSync(filePath);
  const start =
    buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf ? 3 : 0;
  return buf.subarray(start).toString('utf8');
}

async function runSqlFile(
  client,
  relativeFile,
  { stripCreateExtensions = false, stripConflictTargets = false } = {}
) {
  const filePath = path.resolve(__dirname, '..', relativeFile);
  let sql = readUtf8SqlNoBom(filePath);
  if (stripCreateExtensions) {
    sql = sqlWithoutExtensionDeps(sql);
  }
  if (stripConflictTargets) {
    sql = sqlWithoutConflictTargets(sql);
  }
  await client.query(sql);
  // eslint-disable-next-line no-console
  console.log(`[e2e-db] OK ${relativeFile}`);
}

async function main() {
  const url = shouldUseHostVarsForE2e() ? null : directPostgresUrl();

  const sslFromUrl = url && url.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined;
  const sslFromEnv =
    process.env.E2E_DB_SSL === '1' ||
    process.env.E2E_DB_SSL === 'true' ||
    process.env.PGSSLMODE === 'require'
      ? { rejectUnauthorized: false }
      : undefined;
  const ssl = url ? sslFromUrl : sslFromEnv;

  const client = url
    ? new Client({ connectionString: url, ssl })
    : new Client({
        host: required('DB_HOST'),
        port: Number(process.env.DB_PORT ?? 5432),
        user: required('DB_USER'),
        password: required('DB_PASS'),
        database: required('DB_NAME'),
        ssl
      });

  const dbLabel = url ? '(DATABASE_URL)' : `${required('DB_HOST')}/${required('DB_NAME')} (DB_*)`;
  try {
    await client.connect();
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    if (msg.includes('does not exist') || msg.includes('no existe')) {
      throw new Error(
        `La base de datos no existe o no tienes acceso (${dbLabel}).\n` +
          (url ? 'Comprueba DATABASE_URL.' : `Crea la BD en pgAdmin y permisos para el usuario.`)
      );
    }
    throw err;
  }

  const stripExtensions =
    process.env.E2E_SKIP_EXTENSIONS === '1' || process.env.E2E_STRIP_EXTENSIONS === '1';

  try {
    // Reinicio completo para evitar estado residual entre corridas E2E.
    await client.query(`
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
    `);
    // Inicializa esquema y seed en BD de pruebas.
    // Nota: el esquema requiere uuid-ossp y pgcrypto. Si tu usuario no puede crear extensiones,
    // créalas una vez como superusuario en esta BD (o E2E_SKIP_EXTENSIONS=1 en hosts gestionados).
    await runSqlFile(client, 'src/database/baseline/typeorm-baseline-v3.sql', {
      stripCreateExtensions: stripExtensions
    });
    // Compatibilidad con esquemas runtime más nuevos: el seed histórico no incluye lat/lng.
    await client.query(`
      ALTER TABLE IF EXISTS schools
        ADD COLUMN IF NOT EXISTS circuit_enabled boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS address varchar(500) NULL,
        ADD COLUMN IF NOT EXISTS city varchar(120) NULL,
        ADD COLUMN IF NOT EXISTS phone varchar(80) NULL,
        ADD COLUMN IF NOT EXISTS email varchar(200) NULL,
        ADD COLUMN IF NOT EXISTS director_name varchar(200) NULL,
        ADD COLUMN IF NOT EXISTS student_matricula_prefix varchar(20) NULL,
        ADD COLUMN IF NOT EXISTS motto varchar(500) NULL,
        ADD COLUMN IF NOT EXISTS max_grade_scale decimal(5,2) NOT NULL DEFAULT 100,
        ADD COLUMN IF NOT EXISTS passing_grade decimal(5,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS min_failed_subjects_to_repeat integer NOT NULL DEFAULT 3,
        ADD COLUMN IF NOT EXISTS logo_path varchar(500) NULL;
    `);
    await client.query(`
      ALTER TABLE IF EXISTS schools
        ADD COLUMN IF NOT EXISTS latitude numeric(10,8) NULL,
        ADD COLUMN IF NOT EXISTS longitude numeric(11,8) NULL;
    `);
    await client.query(`
      ALTER TABLE IF EXISTS schools
        ALTER COLUMN latitude DROP NOT NULL,
        ALTER COLUMN longitude DROP NOT NULL;
    `);
    await client.query(`
      ALTER TABLE IF EXISTS users
        ADD COLUMN IF NOT EXISTS school_id uuid NULL;
    `);
    await client.query(`
      ALTER TABLE IF EXISTS users
        ADD COLUMN IF NOT EXISTS password_reset_token varchar(128) NULL,
        ADD COLUMN IF NOT EXISTS password_reset_expires_at timestamptz NULL;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS ix_users_password_reset_token
        ON users (password_reset_token) WHERE password_reset_token IS NOT NULL;
    `);
    await client.query(`
      ALTER TABLE IF EXISTS schools
        ADD COLUMN IF NOT EXISTS shift_matutino_start time NULL,
        ADD COLUMN IF NOT EXISTS shift_matutino_end time NULL,
        ADD COLUMN IF NOT EXISTS shift_vespertino_start time NULL,
        ADD COLUMN IF NOT EXISTS shift_vespertino_end time NULL,
        ADD COLUMN IF NOT EXISTS shift_nocturno_start time NULL,
        ADD COLUMN IF NOT EXISTS shift_nocturno_end time NULL;
    `);
    await client.query(`
      ALTER TABLE IF EXISTS groups
        ADD COLUMN IF NOT EXISTS school_id uuid NULL;
    `);
    await client.query(`
      ALTER TABLE IF EXISTS subjects
        ADD COLUMN IF NOT EXISTS school_id uuid NULL;
    `);
    await client.query(`
      ALTER TABLE IF EXISTS subjects
        ADD COLUMN IF NOT EXISTS code varchar(40) NULL,
        ADD COLUMN IF NOT EXISTS education_level varchar(60) NULL,
        ADD COLUMN IF NOT EXISTS grade_scope varchar(60) NULL,
        ADD COLUMN IF NOT EXISTS area varchar(120) NULL,
        ADD COLUMN IF NOT EXISTS description varchar(500) NULL;
    `);
    await client.query(`
      ALTER TABLE IF EXISTS students
        ADD COLUMN IF NOT EXISTS school_id uuid NULL;
    `);
    await client.query(`
      ALTER TABLE IF EXISTS students
        ALTER COLUMN school_id DROP NOT NULL;
    `);
    await client.query(`
      ALTER TABLE IF EXISTS notifications
        ADD COLUMN IF NOT EXISTS link_path varchar(480) NULL;
    `);
    await client.query(`ALTER TABLE payment_concepts ADD COLUMN IF NOT EXISTS school_id uuid NULL`);
    await client.query(`
      DO $$
      BEGIN
        BEGIN
          ALTER TABLE payment_concepts
            ADD CONSTRAINT fk_payment_concepts_school_id
            FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END;
      END $$;
    `);
    await client.query(`
      DO $$
      DECLARE con_name text;
      BEGIN
        SELECT c.conname INTO con_name
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = current_schema()
          AND t.relname = 'payment_concepts'
          AND c.contype = 'u'
          AND array_length(c.conkey, 1) = 1
          AND (
            SELECT a.attname FROM pg_attribute a
            WHERE a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
          ) = 'name'
        LIMIT 1;
        IF con_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE payment_concepts DROP CONSTRAINT %I', con_name);
        END IF;
      END $$;
    `);
    await client.query(`DROP INDEX IF EXISTS payment_concepts_name_key`);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_concepts_school_name
      ON payment_concepts (school_id, lower(name))
      WHERE school_id IS NOT NULL
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_concepts_global_name
      ON payment_concepts (lower(name))
      WHERE school_id IS NULL
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS ix_payment_concepts_school ON payment_concepts (school_id)`
    );
    await runSqlFile(client, 'scripts/database/seed_dev.sql', { stripConflictTargets: true });
    await client.query(`
      INSERT INTO users (email, password_hash, role, full_name, can_access_campus, school_id)
      SELECT
        'administrativo@escuelapass.local',
        crypt('Admin123*', gen_salt('bf')),
        'ADMINISTRATIVO',
        'Administrativo Uno',
        true,
        s.id
      FROM schools s
      WHERE s.code = 'ESCUELA-PRINCIPAL'
      ON CONFLICT DO NOTHING;
    `);
    await client.query(`
      ALTER TABLE IF EXISTS students
        ADD COLUMN IF NOT EXISTS lifecycle_status varchar(16) NOT NULL DEFAULT 'ACTIVO';
      ALTER TABLE IF EXISTS teachers
        ADD COLUMN IF NOT EXISTS lifecycle_status varchar(16) NOT NULL DEFAULT 'ACTIVO';
      ALTER TABLE IF EXISTS academic_periods
        ADD COLUMN IF NOT EXISTS reopened_at timestamptz NULL,
        ADD COLUMN IF NOT EXISTS reopened_by uuid NULL;
      ALTER TABLE IF EXISTS attendance_records
        ADD COLUMN IF NOT EXISTS class_session_id uuid NULL,
        ADD COLUMN IF NOT EXISTS excuse_attachment_path varchar(500) NULL;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS student_lifecycle_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id uuid NOT NULL,
        school_id uuid NULL,
        from_status varchar(16) NOT NULL,
        to_status varchar(16) NOT NULL,
        reason varchar(240) NOT NULL,
        effective_date date NOT NULL,
        changed_by_user_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS teacher_lifecycle_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        teacher_id uuid NOT NULL,
        school_id uuid NULL,
        from_status varchar(16) NOT NULL,
        to_status varchar(16) NOT NULL,
        reason varchar(240) NOT NULL,
        effective_date date NOT NULL,
        changed_by_user_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS ix_student_lifecycle_events_student ON student_lifecycle_events (student_id);
      CREATE INDEX IF NOT EXISTS ix_teacher_lifecycle_events_teacher ON teacher_lifecycle_events (teacher_id);
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_reports (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id uuid NOT NULL,
        created_by_user_id uuid NOT NULL,
        assigned_admin_user_id uuid NULL,
        type varchar(16) NOT NULL DEFAULT 'OTRO',
        subject varchar(160) NOT NULL,
        message text NOT NULL,
        status varchar(16) NOT NULL DEFAULT 'PENDIENTE',
        resolved_by_user_id uuid NULL,
        resolved_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS ix_admin_reports_school_status ON admin_reports (school_id, status);
      CREATE INDEX IF NOT EXISTS ix_admin_reports_created_by ON admin_reports (created_by_user_id);

      CREATE TABLE IF NOT EXISTS admin_report_comments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id uuid NOT NULL,
        user_id uuid NOT NULL,
        message text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS ix_admin_report_comments_report ON admin_report_comments (report_id, created_at);
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS debt_adjustments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        debt_id uuid NOT NULL,
        school_id uuid NOT NULL,
        action_type varchar(32) NOT NULL,
        previous_amount numeric(10,2) NOT NULL,
        delta_amount numeric(10,2) NOT NULL,
        next_amount numeric(10,2) NOT NULL,
        reason varchar(300) NOT NULL,
        policy_cycle_date date NULL,
        changed_by_user_id uuid NULL,
        metadata jsonb NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS ix_debt_adjustments_debt_created ON debt_adjustments (debt_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS ix_debt_adjustments_school_created ON debt_adjustments (school_id, created_at DESC);
    `);
    // Normaliza school_id en datos semilla para compatibilidad con reglas institucionales nuevas.
    await client.query(`
      WITH default_school AS (
        SELECT id FROM schools ORDER BY created_at ASC LIMIT 1
      )
      UPDATE users u
      SET school_id = (SELECT id FROM default_school)
      WHERE u.school_id IS NULL
        AND u.role IN ('ADMINISTRATIVO', 'DOCENTE', 'PADRE', 'ALUMNO');
    `);
    await client.query(`
      WITH default_school AS (
        SELECT id FROM schools ORDER BY created_at ASC LIMIT 1
      )
      UPDATE groups g
      SET school_id = COALESCE(g.school_id, (SELECT id FROM default_school))
      WHERE g.school_id IS NULL;
    `);
    await client.query(`
      WITH default_school AS (
        SELECT id FROM schools ORDER BY created_at ASC LIMIT 1
      )
      UPDATE subjects s
      SET school_id = COALESCE(s.school_id, (SELECT id FROM default_school))
      WHERE s.school_id IS NULL;
    `);
    await client.query(`
      UPDATE subjects
      SET code = COALESCE(NULLIF(code, ''), upper(substr(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g'), 1, 8)))
      WHERE code IS NULL OR code = '';
    `);
    await client.query(`
      WITH default_school AS (
        SELECT id FROM schools ORDER BY created_at ASC LIMIT 1
      )
      INSERT INTO subjects (name, code, school_id)
      SELECT 'Matemáticas', 'MAT', id FROM default_school
      ON CONFLICT DO NOTHING;
    `);
    await client.query(`
      WITH default_school AS (
        SELECT id FROM schools ORDER BY created_at ASC LIMIT 1
      )
      UPDATE students s
      SET school_id = COALESCE(
        s.school_id,
        u.school_id,
        (SELECT g.school_id FROM groups g WHERE g.id = s.group_id),
        (SELECT id FROM default_school)
      )
      FROM users u
      WHERE u.id = s.user_id
        AND s.school_id IS NULL;
    `);
    // Asegura valor de enum por si el esquema antiguo ya tenía circuit_status sin PADRE_EN_CAMINO.
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'circuit_status')
           AND NOT EXISTS (
             SELECT 1 FROM pg_enum e
             JOIN pg_type t ON e.enumtypid = t.oid
             WHERE t.typname = 'circuit_status' AND e.enumlabel = 'PADRE_EN_CAMINO'
           ) THEN
          ALTER TYPE circuit_status ADD VALUE 'PADRE_EN_CAMINO';
        END IF;
      END $$;
    `);
    // eslint-disable-next-line no-console
    console.log('[e2e-db] OK circuit_status.PADRE_EN_CAMINO');
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'circuit_status')
           AND NOT EXISTS (
             SELECT 1 FROM pg_enum e
             JOIN pg_type t ON e.enumtypid = t.oid
             WHERE t.typname = 'circuit_status' AND e.enumlabel = 'CERRADO_SIN_CONFIRMACION_PADRE'
           ) THEN
          ALTER TYPE circuit_status ADD VALUE 'CERRADO_SIN_CONFIRMACION_PADRE';
        END IF;
      END $$;
    `);
    await client.query(`
      ALTER TABLE circuit_requests
      ADD COLUMN IF NOT EXISTS parent_confirm_deadline_at TIMESTAMPTZ NULL,
      ADD COLUMN IF NOT EXISTS parent_confirm_deadline_started_at TIMESTAMPTZ NULL,
      ADD COLUMN IF NOT EXISTS parent_receipt_confirmed_at TIMESTAMPTZ NULL,
      ADD COLUMN IF NOT EXISTS arrival_snapshot_latitude NUMERIC(10, 8) NULL,
      ADD COLUMN IF NOT EXISTS arrival_snapshot_longitude NUMERIC(11, 8) NULL,
      ADD COLUMN IF NOT EXISTS arrival_snapshot_at TIMESTAMPTZ NULL,
      ADD COLUMN IF NOT EXISTS pickup_vehicle_description VARCHAR(120) NULL,
      ADD COLUMN IF NOT EXISTS pickup_notes VARCHAR(240) NULL;
    `);
    // eslint-disable-next-line no-console
    console.log('[e2e-db] OK circuit_status.CERRADO_SIN_CONFIRMACION_PADRE + columnas padre');
    // Evita datos de corridas E2E anteriores (días sin clases / asistencias con "hoy").
    await client.query(`
      TRUNCATE TABLE attendance_records RESTART IDENTITY CASCADE;
      TRUNCATE TABLE school_non_instructional_days RESTART IDENTITY CASCADE;
    `);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[e2e-db] Error:', err);
  process.exit(1);
});

