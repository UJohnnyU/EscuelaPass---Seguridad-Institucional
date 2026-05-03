-- =============================================================
-- ESCUELA PASS — Esquema PostgreSQL v4 (completo y autónomo)
-- Incluye todas las tablas y columnas hasta la migración actual.
-- Ejecutar en una base de datos vacía.
-- Requiere: PostgreSQL 13+
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ──────────────────────────────────────────────
-- TIPOS ENUMERADOS
-- ──────────────────────────────────────────────

DO $$ BEGIN CREATE TYPE user_role AS ENUM (
  'ADMIN', 'ADMINISTRATIVO', 'DOCENTE', 'PADRE', 'ALUMNO'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE shift_type AS ENUM (
  'MATUTINO', 'VESPERTINO', 'NOCTURNO'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE credential_type AS ENUM ('QR', 'NFC');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE credential_status AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE access_event_type AS ENUM ('ENTRY', 'EXIT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE access_method AS ENUM ('QR', 'NFC', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE pickup_method AS ENUM (
  'VEHICULO_REGISTRADO', 'OTRO_VEHICULO', 'A_PIE', 'TRANSPORTE_PUBLICO', 'SOLO_CONSENTIMIENTO'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE circuit_status AS ENUM (
  'PENDIENTE', 'PADRE_EN_CAMINO', 'NOTIFICADO_LLEGADA', 'AUTORIZADO_SALIR',
  'EN_CAMINO', 'ENTREGADO', 'CERRADO_SIN_CONFIRMACION_PADRE', 'CONSENTIDO_SOLO', 'CANCELADO'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE notice_target_type AS ENUM ('ALL', 'GROUP', 'USER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE payment_status AS ENUM ('PENDIENTE', 'PAGADO', 'VENCIDO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE attendance_status AS ENUM ('PRESENTE', 'AUSENTE', 'RETARDO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE consent_type AS ENUM ('SALIDA_SOLO', 'SALIDA_CON_OTRA_PERSONA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE attention_severity AS ENUM ('LEVE', 'MODERADA', 'GRAVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ──────────────────────────────────────────────
-- ESCUELAS (raíz multi-tenant)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schools (
  id                         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name                       VARCHAR(160) NOT NULL UNIQUE,
  code                       VARCHAR(60)  NOT NULL UNIQUE,
  status                     BOOLEAN      NOT NULL DEFAULT TRUE,
  circuit_enabled            BOOLEAN      NOT NULL DEFAULT TRUE,
  address                    VARCHAR(500),
  city                       VARCHAR(120),
  phone                      VARCHAR(80),
  email                      VARCHAR(200),
  director_name              VARCHAR(200),
  student_matricula_prefix   VARCHAR(20),
  motto                      VARCHAR(500),
  max_grade_scale            NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  passing_grade              NUMERIC(5,2) NOT NULL DEFAULT 60.00,
  min_failed_subjects_to_repeat INT        NOT NULL DEFAULT 3,
  latitude                   NUMERIC(10,8) NOT NULL DEFAULT 0,
  longitude                  NUMERIC(11,8) NOT NULL DEFAULT 0,
  logo_path                  VARCHAR(500),
  created_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- USUARIOS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email                    VARCHAR(255) UNIQUE NOT NULL,
  password_hash            VARCHAR(255) NOT NULL,
  role                     user_role    NOT NULL,
  full_name                VARCHAR(255) NOT NULL,
  phone                    VARCHAR(30),
  can_access_campus        BOOLEAN      NOT NULL DEFAULT FALSE,
  status                   BOOLEAN      NOT NULL DEFAULT TRUE,
  school_id                UUID         REFERENCES schools(id) ON DELETE SET NULL,
  avatar_path              VARCHAR(500),
  password_reset_token     VARCHAR(128),
  password_reset_expires_at TIMESTAMPTZ,
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_users_password_reset_token
  ON users (password_reset_token) WHERE password_reset_token IS NOT NULL;

-- ──────────────────────────────────────────────
-- GRUPOS ESCOLARES
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groups (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  grade       VARCHAR(50),
  shift       shift_type   NOT NULL DEFAULT 'MATUTINO',
  school_year VARCHAR(20)  NOT NULL,
  classroom   VARCHAR(50),
  capacity    INTEGER      CHECK (capacity IS NULL OR capacity > 0),
  status      BOOLEAN      NOT NULL DEFAULT TRUE,
  school_id   UUID         REFERENCES schools(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (name, school_year, school_id)
);

-- ──────────────────────────────────────────────
-- DOCENTES
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teachers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  employee_number  VARCHAR(50) UNIQUE NOT NULL,
  lifecycle_status VARCHAR(16) NOT NULL DEFAULT 'ACTIVO'
    CONSTRAINT ck_teachers_lifecycle_status CHECK (lifecycle_status IN ('ACTIVO','BAJA','TRASLADO','EGRESADO')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_teachers_lifecycle_status ON teachers (lifecycle_status);

-- ──────────────────────────────────────────────
-- PADRES / TUTORES
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parents (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID    NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  is_primary_contact  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- PERSONAL ADMINISTRATIVO
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS administrative_staff (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  employee_number VARCHAR(50) UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- MATERIAS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subjects (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL,
  code            VARCHAR(30)  NOT NULL,
  school_id       UUID         REFERENCES schools(id) ON DELETE RESTRICT,
  description     TEXT,
  education_level VARCHAR(80),
  grade_scope     VARCHAR(80),
  area            VARCHAR(80),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_subjects_school_name
  ON subjects (school_id, lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS uq_subjects_school_code_ci
  ON subjects (school_id, lower(code));

-- ──────────────────────────────────────────────
-- ESTUDIANTES
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  matricula        VARCHAR(50) NOT NULL,
  school_id        UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  group_id         UUID        REFERENCES groups(id) ON DELETE SET NULL,
  can_leave_alone  BOOLEAN     NOT NULL DEFAULT FALSE,
  lifecycle_status VARCHAR(16) NOT NULL DEFAULT 'ACTIVO'
    CONSTRAINT ck_students_lifecycle_status CHECK (lifecycle_status IN ('ACTIVO','BAJA','TRASLADO','EGRESADO')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_students_school_matricula
  ON students (school_id, matricula);
CREATE INDEX IF NOT EXISTS ix_students_school_id       ON students (school_id);
CREATE INDEX IF NOT EXISTS ix_students_lifecycle_status ON students (lifecycle_status);

-- ──────────────────────────────────────────────
-- ASIGNACIÓN DOCENTE-GRUPO-MATERIA
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teacher_groups (
  id                      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id              UUID    NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  group_id                UUID    NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  subject_id              UUID    REFERENCES subjects(id) ON DELETE SET NULL,
  is_main_teacher         BOOLEAN NOT NULL DEFAULT FALSE,
  can_authorize_departures BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (teacher_id, group_id, subject_id)
);

-- ──────────────────────────────────────────────
-- ESPECIALIDADES DE DOCENTES
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teacher_subjects (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_subjects_teacher_subject
  ON teacher_subjects (teacher_id, subject_id);

-- ──────────────────────────────────────────────
-- RELACIÓN ESTUDIANTE-PADRE
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_parents (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_id    UUID        NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  relationship VARCHAR(50) NOT NULL,
  is_primary   BOOLEAN     NOT NULL DEFAULT FALSE,
  can_pickup   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, parent_id)
);

-- ──────────────────────────────────────────────
-- VEHÍCULOS DE PADRES
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   UUID        NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  plate       VARCHAR(20) NOT NULL,
  description VARCHAR(255),
  brand       VARCHAR(100),
  model       VARCHAR(100),
  color       VARCHAR(50),
  year        INTEGER     CHECK (year IS NULL OR (year BETWEEN 1970 AND 2100)),
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (parent_id, plate)
);

-- ──────────────────────────────────────────────
-- AUTORIZACIONES DE RETIRO
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pickup_authorizations (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID    NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_id  UUID    NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  vehicle_id UUID    REFERENCES vehicles(id) ON DELETE SET NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- CREDENCIALES DE ACCESO (QR / NFC)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS access_credentials (
  id               UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_type  credential_type   NOT NULL,
  credential_value VARCHAR(500)      NOT NULL,
  status           credential_status NOT NULL DEFAULT 'ACTIVE',
  created_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  UNIQUE (credential_type, credential_value)
);

-- ──────────────────────────────────────────────
-- EVENTOS DE ACCESO (entradas / salidas)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS access_events (
  id                   UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_snapshot        user_role        NOT NULL,
  event_type           access_event_type NOT NULL,
  method               access_method    NOT NULL,
  event_time           TIMESTAMPTZ      NOT NULL,
  event_date           DATE             NOT NULL,
  access_credential_id UUID             REFERENCES access_credentials(id) ON DELETE SET NULL,
  registered_by        UUID             REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_access_events_user_date ON access_events (user_id, event_date);

-- ──────────────────────────────────────────────
-- REFRESH TOKENS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- CONSENTIMIENTOS DE SALIDA AUTÓNOMA
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_departure_consents (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID         NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_id    UUID         NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  consent_type consent_type NOT NULL,
  valid_from   DATE         NOT NULL,
  valid_until  DATE         NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- SOLICITUDES DE CIRCUITO (recogida de estudiantes)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS circuit_requests (
  id                          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id                  UUID           NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  requested_by_parent_id      UUID           NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  pickup_method               pickup_method  NOT NULL,
  status                      circuit_status NOT NULL DEFAULT 'PENDIENTE',
  request_time                TIMESTAMPTZ    NOT NULL,
  parent_gps_latitude         NUMERIC(10,8),
  parent_gps_longitude        NUMERIC(11,8),
  arrival_snapshot_latitude   NUMERIC(10,8),
  arrival_snapshot_longitude  NUMERIC(11,8),
  arrival_snapshot_at         TIMESTAMPTZ,
  vehicle_id                  UUID           REFERENCES vehicles(id) ON DELETE SET NULL,
  pickup_vehicle_description  VARCHAR(120),
  pickup_notes                VARCHAR(240),
  teacher_signal              VARCHAR(40),
  parent_confirm_deadline_at  TIMESTAMPTZ,
  parent_receipt_confirmed_at TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- AVISOS Y NOTIFICACIONES
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notices (
  id              UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  title           VARCHAR(255)       NOT NULL,
  content         TEXT               NOT NULL,
  target_type     notice_target_type NOT NULL,
  target_user_id  UUID               REFERENCES users(id) ON DELETE SET NULL,
  target_group_id UUID               REFERENCES groups(id) ON DELETE SET NULL,
  created_by      UUID               REFERENCES users(id) ON DELETE SET NULL,
  is_important    BOOLEAN            NOT NULL DEFAULT FALSE,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notice_id       UUID        REFERENCES notices(id) ON DELETE SET NULL,
  title           VARCHAR(255) NOT NULL,
  message         TEXT        NOT NULL,
  read_at         TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivery_status VARCHAR(20) NOT NULL DEFAULT 'SENT'
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id);

-- ──────────────────────────────────────────────
-- CONCEPTOS DE PAGO Y COBROS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_concepts (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(100) NOT NULL,
  school_id         UUID         REFERENCES schools(id) ON DELETE CASCADE,
  description       TEXT,
  is_base           BOOLEAN      NOT NULL DEFAULT FALSE,
  default_amount    DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_recurring      BOOLEAN      NOT NULL DEFAULT FALSE,
  recurrence_period VARCHAR(20),
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_concepts_school_name
  ON payment_concepts (school_id, lower(name)) WHERE school_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_concepts_global_name
  ON payment_concepts (lower(name)) WHERE school_id IS NULL;
CREATE INDEX IF NOT EXISTS ix_payment_concepts_school ON payment_concepts (school_id);

CREATE TABLE IF NOT EXISTS debts (
  id                   UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id           UUID           NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  concept_id           UUID           NOT NULL REFERENCES payment_concepts(id) ON DELETE RESTRICT,
  amount               DECIMAL(10,2)  NOT NULL,
  due_date             DATE           NOT NULL,
  status               payment_status NOT NULL DEFAULT 'PENDIENTE',
  description          TEXT,
  voucher_path         VARCHAR(500),
  uploaded_by_parent_id UUID          REFERENCES parents(id) ON DELETE SET NULL,
  uploaded_at          TIMESTAMPTZ,
  verified_by_admin_id UUID           REFERENCES administrative_staff(id) ON DELETE SET NULL,
  verified_at          TIMESTAMPTZ,
  notes                TEXT,
  created_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_debts_student ON debts (student_id);

CREATE TABLE IF NOT EXISTS payments (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id              UUID        NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  payment_date         DATE        NOT NULL,
  amount_paid          DECIMAL(10,2) NOT NULL,
  payment_method       VARCHAR(50),
  voucher_path         VARCHAR(500),
  reference_number     VARCHAR(100),
  verified_by_admin_id UUID        REFERENCES administrative_staff(id) ON DELETE SET NULL,
  verified_at          TIMESTAMPTZ,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS debt_adjustments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id           UUID        NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  school_id         UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  action_type       VARCHAR(32) NOT NULL
    CHECK (action_type IN ('LATE_FEE','ARRANGEMENT','MANUAL_ADJUSTMENT','STATUS_CHANGE')),
  previous_amount   NUMERIC(10,2) NOT NULL,
  delta_amount      NUMERIC(10,2) NOT NULL,
  next_amount       NUMERIC(10,2) NOT NULL,
  reason            VARCHAR(300) NOT NULL,
  policy_cycle_date DATE,
  changed_by_user_id UUID        REFERENCES users(id) ON DELETE SET NULL,
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_debt_adjustments_debt_created
  ON debt_adjustments (debt_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_debt_adjustments_school_created
  ON debt_adjustments (school_id, created_at DESC);

-- ──────────────────────────────────────────────
-- ASISTENCIA
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance_records (
  id               UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID              NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  group_id         UUID              REFERENCES groups(id) ON DELETE SET NULL,
  attendance_date  DATE              NOT NULL,
  status           attendance_status NOT NULL DEFAULT 'PRESENTE',
  is_justified     BOOLEAN,
  notes            TEXT,
  registered_by    UUID              REFERENCES users(id) ON DELETE SET NULL,
  class_session_id UUID,
  created_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, attendance_date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date
  ON attendance_records (student_id, attendance_date);

-- ──────────────────────────────────────────────
-- DÍAS NO LECTIVOS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS school_non_instructional_days (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  exception_date DATE        NOT NULL,
  group_id       UUID        REFERENCES groups(id) ON DELETE CASCADE,
  school_id      UUID        REFERENCES schools(id) ON DELETE CASCADE,
  reason         TEXT,
  created_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_non_instr_global_has_school
    CHECK (group_id IS NOT NULL OR school_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_school_non_instr_school_date
  ON school_non_instructional_days (school_id, exception_date) WHERE group_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_school_non_instr_group
  ON school_non_instructional_days (exception_date, group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_school_non_instr_date
  ON school_non_instructional_days (exception_date);

-- ──────────────────────────────────────────────
-- CONFIGURACIÓN INSTITUCIONAL
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS institution_settings (
  setting_key VARCHAR(64) PRIMARY KEY,
  value       TEXT        NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO institution_settings (setting_key, value)
VALUES ('circuit.enabled', 'true')
ON CONFLICT (setting_key) DO NOTHING;

-- ──────────────────────────────────────────────
-- PERÍODOS ACADÉMICOS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academic_periods (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  school_year VARCHAR(20) NOT NULL,
  name        VARCHAR(80) NOT NULL,
  order_index INT         NOT NULL,
  start_date  DATE        NOT NULL,
  end_date    DATE        NOT NULL,
  weight      NUMERIC(5,2) NOT NULL,
  status      VARCHAR(16) NOT NULL DEFAULT 'PLANNED'
    CONSTRAINT ck_academic_periods_status CHECK (status IN ('PLANNED','ACTIVE','CLOSED')),
  closed_at   TIMESTAMPTZ,
  closed_by   UUID,
  reopened_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_academic_periods_dates CHECK (end_date >= start_date)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_academic_periods_order
  ON academic_periods (school_id, school_year, order_index);
CREATE INDEX IF NOT EXISTS ix_academic_periods_school_status
  ON academic_periods (school_id, status);

-- ──────────────────────────────────────────────
-- SESIONES DE CLASE (horario operativo)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS class_sessions (
  id                UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID     NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_period_id UUID    NOT NULL REFERENCES academic_periods(id) ON DELETE CASCADE,
  group_id          UUID     NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  subject_id        UUID     NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  teacher_id        UUID     NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
  weekday           SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time        TIME     NOT NULL,
  end_time          TIME     NOT NULL,
  room              VARCHAR(80),
  is_active         BOOLEAN  NOT NULL DEFAULT TRUE,
  created_by_user_id UUID    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by_user_id UUID    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_class_sessions_weekday CHECK (weekday BETWEEN 0 AND 6),
  CONSTRAINT ck_class_sessions_times CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS ix_class_sessions_school_period_weekday
  ON class_sessions (school_id, academic_period_id, weekday);
CREATE INDEX IF NOT EXISTS ix_class_sessions_group   ON class_sessions (group_id);
CREATE INDEX IF NOT EXISTS ix_class_sessions_teacher ON class_sessions (teacher_id);

ALTER TABLE attendance_records
  ADD CONSTRAINT fk_attendance_records_class_session
  FOREIGN KEY (class_session_id) REFERENCES class_sessions(id) ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX IF NOT EXISTS ix_attendance_records_class_session
  ON attendance_records (class_session_id);

-- ──────────────────────────────────────────────
-- HORARIO SEMANAL (ranuras fijas)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS class_schedule_slots (
  id         UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID     NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  weekday    SMALLINT NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  start_time TIME     NOT NULL,
  end_time   TIME     NOT NULL,
  subject_id UUID     REFERENCES subjects(id) ON DELETE SET NULL,
  teacher_id UUID     REFERENCES teachers(id) ON DELETE SET NULL,
  room       VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS idx_schedule_slots_group ON class_schedule_slots (group_id);

-- ──────────────────────────────────────────────
-- ACTIVIDADES Y CALIFICACIONES
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activities (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id   UUID        NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  group_id     UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  subject_id   UUID        NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  subject_name VARCHAR(100) NOT NULL,
  period_id    UUID        REFERENCES academic_periods(id) ON DELETE SET NULL,
  title        VARCHAR(150) NOT NULL,
  description  TEXT,
  period       VARCHAR(50)  NOT NULL,
  max_score    NUMERIC(6,2) NOT NULL,
  due_date     DATE,
  status       VARCHAR(16)  NOT NULL DEFAULT 'OPEN'
    CONSTRAINT ck_activities_status CHECK (status IN ('OPEN','CLOSED')),
  closed_at    TIMESTAMPTZ,
  closed_by    UUID,
  reopened_at  TIMESTAMPTZ,
  reopened_by  UUID,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_activities_group_status ON activities (group_id, status);
CREATE INDEX IF NOT EXISTS ix_activities_teacher      ON activities (teacher_id);

CREATE TABLE IF NOT EXISTS activity_grades (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID        NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  student_id  UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  score       NUMERIC(6,2) NOT NULL,
  notes       TEXT,
  graded_by   UUID,
  graded_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_grades_activity_student
  ON activity_grades (activity_id, student_id);
CREATE INDEX IF NOT EXISTS ix_activity_grades_student ON activity_grades (student_id);

-- ──────────────────────────────────────────────
-- BOLETINES
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS report_cards (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id           UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id            UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  school_year          VARCHAR(20) NOT NULL,
  type                 VARCHAR(10) NOT NULL
    CONSTRAINT ck_report_cards_type CHECK (type IN ('PERIOD','FINAL')),
  period_id            UUID        REFERENCES academic_periods(id) ON DELETE SET NULL,
  overall_average      NUMERIC(6,2),
  failed_subjects_count INT         NOT NULL DEFAULT 0,
  promotion_status     VARCHAR(32),
  generated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at         TIMESTAMPTZ,
  status               VARCHAR(16) NOT NULL DEFAULT 'DRAFT'
    CONSTRAINT ck_report_cards_status CHECK (status IN ('DRAFT','PUBLISHED')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_report_cards_student_year
  ON report_cards (student_id, school_year);
CREATE UNIQUE INDEX IF NOT EXISTS uq_report_cards_period
  ON report_cards (student_id, period_id) WHERE period_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_report_cards_final
  ON report_cards (student_id, school_year) WHERE type = 'FINAL';

CREATE TABLE IF NOT EXISTS report_card_subjects (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_card_id UUID        NOT NULL REFERENCES report_cards(id) ON DELETE CASCADE,
  subject_id     UUID        NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  subject_name   VARCHAR(100) NOT NULL,
  average        NUMERIC(6,2) NOT NULL,
  activity_count INT          NOT NULL DEFAULT 0,
  graded_count   INT          NOT NULL DEFAULT 0,
  is_passing     BOOLEAN      NOT NULL DEFAULT FALSE
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_report_card_subjects_card_subject
  ON report_card_subjects (report_card_id, subject_id);

-- ──────────────────────────────────────────────
-- EVENTOS DE CICLO DE VIDA (docentes / estudiantes)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teacher_lifecycle_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id        UUID        NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  school_id         UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  from_status       VARCHAR(16) NOT NULL
    CONSTRAINT ck_tl_from CHECK (from_status IN ('ACTIVO','BAJA','TRASLADO','EGRESADO')),
  to_status         VARCHAR(16) NOT NULL
    CONSTRAINT ck_tl_to CHECK (to_status IN ('ACTIVO','BAJA','TRASLADO','EGRESADO')),
  reason            VARCHAR(240) NOT NULL,
  effective_date    DATE         NOT NULL,
  changed_by_user_id UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_teacher_lifecycle_events_teacher
  ON teacher_lifecycle_events (teacher_id);
CREATE INDEX IF NOT EXISTS ix_teacher_lifecycle_events_school_created
  ON teacher_lifecycle_events (school_id, created_at DESC);

CREATE TABLE IF NOT EXISTS student_lifecycle_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id         UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  from_status       VARCHAR(16) NOT NULL
    CONSTRAINT ck_sl_from CHECK (from_status IN ('ACTIVO','BAJA','TRASLADO','EGRESADO')),
  to_status         VARCHAR(16) NOT NULL
    CONSTRAINT ck_sl_to CHECK (to_status IN ('ACTIVO','BAJA','TRASLADO','EGRESADO')),
  reason            VARCHAR(240) NOT NULL,
  effective_date    DATE         NOT NULL,
  changed_by_user_id UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_student_lifecycle_events_student
  ON student_lifecycle_events (student_id);
CREATE INDEX IF NOT EXISTS ix_student_lifecycle_events_school_created
  ON student_lifecycle_events (school_id, created_at DESC);

-- ──────────────────────────────────────────────
-- VISITAS EXTERNAS AL PLANTEL
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS external_visits (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id            UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_by_user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  creator_role         VARCHAR(20) NOT NULL,
  title                VARCHAR(150) NOT NULL,
  purpose              TEXT        NOT NULL,
  visitor_name         VARCHAR(150) NOT NULL,
  visitor_organization VARCHAR(150),
  location             VARCHAR(200),
  visit_datetime       TIMESTAMPTZ NOT NULL,
  duration_minutes     INTEGER     NOT NULL DEFAULT 60
    CHECK (duration_minutes BETWEEN 5 AND 600),
  audience_scope       VARCHAR(16) NOT NULL
    CHECK (audience_scope IN ('SCHOOL','GROUPS','STUDENTS')),
  status               VARCHAR(16) NOT NULL DEFAULT 'PROGRAMADA'
    CHECK (status IN ('PROGRAMADA','REPROGRAMADA','REALIZADA','CANCELADA')),
  cancellation_reason  TEXT,
  previous_datetime    TIMESTAMPTZ,
  reminded_24h_at      TIMESTAMPTZ,
  reminded_1h_at       TIMESTAMPTZ,
  auto_finalized_at    TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_external_visits_school_datetime
  ON external_visits (school_id, visit_datetime);
CREATE INDEX IF NOT EXISTS ix_external_visits_status ON external_visits (status);

CREATE TABLE IF NOT EXISTS external_visit_groups (
  visit_id  UUID NOT NULL REFERENCES external_visits(id) ON DELETE CASCADE,
  group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (visit_id, group_id)
);
CREATE TABLE IF NOT EXISTS external_visit_students (
  visit_id   UUID NOT NULL REFERENCES external_visits(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  PRIMARY KEY (visit_id, student_id)
);

-- ──────────────────────────────────────────────
-- REUNIONES INTERNAS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meetings (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  organizer_user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  organizer_role      VARCHAR(20) NOT NULL,
  title               VARCHAR(150) NOT NULL,
  purpose             TEXT        NOT NULL,
  modality            VARCHAR(16) NOT NULL DEFAULT 'PRESENCIAL'
    CHECK (modality IN ('PRESENCIAL','VIRTUAL')),
  location            VARCHAR(200),
  meeting_link        VARCHAR(500),
  start_at            TIMESTAMPTZ NOT NULL,
  duration_minutes    INTEGER     NOT NULL DEFAULT 30
    CHECK (duration_minutes BETWEEN 5 AND 600),
  status              VARCHAR(16) NOT NULL DEFAULT 'PROGRAMADA'
    CHECK (status IN ('PROGRAMADA','REPROGRAMADA','EN_CURSO','REALIZADA','CANCELADA')),
  cancellation_reason TEXT,
  previous_start_at   TIMESTAMPTZ,
  reminded_24h_at     TIMESTAMPTZ,
  reminded_1h_at      TIMESTAMPTZ,
  auto_finalized_at   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_meetings_school_start ON meetings (school_id, start_at);
CREATE INDEX IF NOT EXISTS ix_meetings_status       ON meetings (status);

CREATE TABLE IF NOT EXISTS meeting_participants (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id         UUID        NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id            UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant_role   VARCHAR(20) NOT NULL,
  student_context_id UUID        REFERENCES students(id) ON DELETE SET NULL,
  rsvp               VARCHAR(16) NOT NULL DEFAULT 'PENDIENTE'
    CHECK (rsvp IN ('PENDIENTE','ACEPTADA','DECLINADA')),
  responded_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (meeting_id, user_id)
);
CREATE INDEX IF NOT EXISTS ix_meeting_participants_user ON meeting_participants (user_id);

-- ──────────────────────────────────────────────
-- ANOTACIONES DE ATENCIÓN AL ESTUDIANTE
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_attention_notes (
  id                UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID              NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_by_user_id UUID             NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  severity          attention_severity NOT NULL DEFAULT 'LEVE',
  title             VARCHAR(200)      NOT NULL,
  description       TEXT              NOT NULL,
  occurred_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  notified_parent   BOOLEAN           NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_student_attention_notes_student
  ON student_attention_notes (student_id, occurred_at DESC);

-- ──────────────────────────────────────────────
-- REPORTES ADMINISTRATIVOS Y COMENTARIOS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_reports (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_by_user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_admin_user_id UUID       REFERENCES users(id) ON DELETE SET NULL,
  type                  VARCHAR(16) NOT NULL DEFAULT 'OTRO'
    CONSTRAINT ck_admin_reports_type CHECK (type IN ('ERROR','SUGERENCIA','PETICION','OTRO')),
  subject               VARCHAR(160) NOT NULL,
  message               TEXT         NOT NULL,
  status                VARCHAR(16)  NOT NULL DEFAULT 'PENDIENTE'
    CONSTRAINT ck_admin_reports_status CHECK (status IN ('PENDIENTE','EN_PROCESO','RESUELTO')),
  resolved_by_user_id   UUID         REFERENCES users(id) ON DELETE SET NULL,
  resolved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_admin_reports_school_status
  ON admin_reports (school_id, status);
CREATE INDEX IF NOT EXISTS ix_admin_reports_created_by
  ON admin_reports (created_by_user_id);

CREATE TABLE IF NOT EXISTS admin_report_comments (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID        NOT NULL REFERENCES admin_reports(id) ON DELETE CASCADE,
  user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  message   TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_admin_report_comments_report
  ON admin_report_comments (report_id, created_at);

-- ──────────────────────────────────────────────
-- FCM TOKENS, AUDITORÍA Y PRIVACIDAD
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_fcm_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT        NOT NULL UNIQUE,
  platform   VARCHAR(32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_user ON user_fcm_tokens (user_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80),
  entity_id   UUID,
  metadata    JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user    ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS privacy_policies (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version      VARCHAR(32) NOT NULL UNIQUE,
  title        VARCHAR(255) NOT NULL,
  content      TEXT         NOT NULL,
  effective_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_privacy_acceptances (
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  policy_version VARCHAR(32) NOT NULL,
  accepted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address     INET,
  PRIMARY KEY (user_id, policy_version)
);

-- ──────────────────────────────────────────────
-- IMPORTACIONES
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS import_jobs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          VARCHAR(50) NOT NULL,
  total_rows    INTEGER     NOT NULL CHECK (total_rows >= 0),
  created_count INTEGER     NOT NULL CHECK (created_count >= 0),
  error_count   INTEGER     NOT NULL CHECK (error_count >= 0),
  dry_run       BOOLEAN     NOT NULL DEFAULT FALSE,
  school_id     UUID        REFERENCES schools(id) ON DELETE SET NULL,
  errors_json   JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_import_jobs_kind_created
  ON import_jobs (kind, created_at DESC);
