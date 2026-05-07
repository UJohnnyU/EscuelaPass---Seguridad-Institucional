-- =============================================================
-- ESCUELA PASS — Baseline SQL congelado (histórico v3) para TypeORM
-- =============================================================
-- Uso previsto:
--   • Migración 1712050000000-BaselineSchema (`npm run migration:run` en BD vacía).
--   • Inicialización de BD en tests E2E (`test/setup-e2e-db.js`).
-- No emplear como fuente de verdad operativa ni aplicar en producción salvo
-- un diagnóstico explícito. Esquema completo y actualizado: ver
-- escuela_pass_schema_v4.sql en la raíz del proyecto (`npm run db:apply`).
-- Requisitos: PostgreSQL 13+; extensiones uuid-ossp y pgcrypto cuando aplique.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tipos enumerados
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('ADMIN', 'ADMINISTRATIVO', 'DOCENTE', 'PADRE', 'ALUMNO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE shift_type AS ENUM ('MATUTINO', 'VESPERTINO', 'NOCTURNO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE credential_type AS ENUM ('QR', 'NFC');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE credential_status AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE access_event_type AS ENUM ('ENTRY', 'EXIT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE access_method AS ENUM ('QR', 'NFC', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Modalidad de retiro: conductores = padres/tutores (sin transporte escolar en el modelo).
DO $$ BEGIN
  CREATE TYPE pickup_method AS ENUM (
    'VEHICULO_REGISTRADO', 'OTRO_VEHICULO', 'A_PIE', 'SOLO_CONSENTIMIENTO'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Circuito: sin cambio de estado automático por proximidad GPS; el padre avanza estados explícitos.
DO $$ BEGIN
  CREATE TYPE circuit_status AS ENUM (
    'PENDIENTE', 'PADRE_EN_CAMINO', 'NOTIFICADO_LLEGADA', 'AUTORIZADO_SALIR', 'EN_CAMINO',
    'ENTREGADO', 'CONSENTIDO_SOLO', 'CANCELADO'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notice_target_type AS ENUM ('ALL', 'GROUP', 'USER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('PENDIENTE', 'PAGADO', 'VENCIDO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM ('PRESENTE', 'AUSENTE', 'RETARDO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE consent_type AS ENUM ('SALIDA_SOLO', 'SALIDA_CON_OTRA_PERSONA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attention_severity AS ENUM ('LEVE', 'MODERADA', 'GRAVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Escuelas (multi-tenant)
CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(160) NOT NULL UNIQUE,
    code VARCHAR(60) NOT NULL UNIQUE,
    status BOOLEAN NOT NULL DEFAULT TRUE,
    address VARCHAR(500),
    city VARCHAR(120),
    phone VARCHAR(80),
    email VARCHAR(200),
    director_name VARCHAR(200),
    motto VARCHAR(500),
    max_grade_scale NUMERIC(5,2) NOT NULL DEFAULT 100.00,
    passing_grade NUMERIC(5,2) NOT NULL DEFAULT 0,
    min_failed_subjects_to_repeat INT NOT NULL DEFAULT 3,
    latitude NUMERIC(10,8),
    longitude NUMERIC(11,8),
    logo_path VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Usuarios
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    can_access_campus BOOLEAN NOT NULL DEFAULT FALSE,
    status BOOLEAN NOT NULL DEFAULT TRUE,
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
    avatar_path VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Grupos escolares
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    grade VARCHAR(50),
    shift shift_type NOT NULL DEFAULT 'MATUTINO',
    school_year VARCHAR(20) NOT NULL,
    classroom VARCHAR(50),
    capacity INTEGER CHECK (capacity IS NULL OR capacity > 0),
    status BOOLEAN NOT NULL DEFAULT TRUE,
    school_id UUID REFERENCES schools(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (name, school_year, school_id)
);

-- Docentes
CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    employee_number VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Padres / tutores
CREATE TABLE IF NOT EXISTS parents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    is_primary_contact BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Personal administrativo
CREATE TABLE IF NOT EXISTS administrative_staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    employee_number VARCHAR(50) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Estudiantes
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    matricula VARCHAR(50) UNIQUE NOT NULL,
    group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
    can_leave_alone BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Materias (para asignación docente-grupo)
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    school_id UUID REFERENCES schools(id) ON DELETE RESTRICT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Compatibilidad con bases antiguas (antes UNIQUE(name) global)
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_subjects_school_name ON subjects(school_id, lower(name));

CREATE TABLE IF NOT EXISTS teacher_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    is_main_teacher BOOLEAN NOT NULL DEFAULT FALSE,
    can_authorize_departures BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (teacher_id, group_id, subject_id)
);

CREATE TABLE IF NOT EXISTS student_parents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    relationship VARCHAR(50) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    can_pickup BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (student_id, parent_id)
);

CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    plate VARCHAR(20) NOT NULL,
    description VARCHAR(255),
    brand VARCHAR(100),
    model VARCHAR(100),
    color VARCHAR(50),
    year INTEGER CHECK (year IS NULL OR (year BETWEEN 1970 AND 2100)),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (parent_id, plate)
);

CREATE TABLE IF NOT EXISTS pickup_authorizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS access_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_type credential_type NOT NULL,
    credential_value VARCHAR(500) NOT NULL,
    status credential_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (credential_type, credential_value)
);

CREATE TABLE IF NOT EXISTS access_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_snapshot user_role NOT NULL,
    event_type access_event_type NOT NULL,
    method access_method NOT NULL,
    event_time TIMESTAMPTZ NOT NULL,
    event_date DATE NOT NULL,
    access_credential_id UUID REFERENCES access_credentials(id) ON DELETE SET NULL,
    registered_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student_departure_consents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    consent_type consent_type NOT NULL,
    valid_from DATE NOT NULL,
    valid_until DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS circuit_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    requested_by_parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    pickup_method pickup_method NOT NULL,
    status circuit_status NOT NULL DEFAULT 'PENDIENTE',
    request_time TIMESTAMPTZ NOT NULL,
    parent_gps_latitude NUMERIC(10, 8),
    parent_gps_longitude NUMERIC(11, 8),
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    teacher_signal VARCHAR(40),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    target_type notice_target_type NOT NULL,
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_important BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notice_id UUID REFERENCES notices(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    read_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    delivery_status VARCHAR(20) NOT NULL DEFAULT 'SENT'
);

CREATE TABLE IF NOT EXISTS payment_concepts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_base BOOLEAN NOT NULL DEFAULT FALSE,
    default_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    recurrence_period VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS debts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    concept_id UUID NOT NULL REFERENCES payment_concepts(id) ON DELETE RESTRICT,
    amount DECIMAL(10, 2) NOT NULL,
    due_date DATE NOT NULL,
    status payment_status NOT NULL DEFAULT 'PENDIENTE',
    description TEXT,
    voucher_path VARCHAR(500),
    uploaded_by_parent_id UUID REFERENCES parents(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ,
    verified_by_admin_id UUID REFERENCES administrative_staff(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL,
    amount_paid DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50),
    voucher_path VARCHAR(500),
    reference_number VARCHAR(100),
    verified_by_admin_id UUID REFERENCES administrative_staff(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
    attendance_date DATE NOT NULL,
    status attendance_status NOT NULL DEFAULT 'PRESENTE',
    is_justified BOOLEAN,
    notes TEXT,
    registered_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (student_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS school_non_instructional_days (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exception_date DATE NOT NULL,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    reason TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_non_instr_global_has_school CHECK (group_id IS NOT NULL OR school_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_school_non_instr_school_date
ON school_non_instructional_days (school_id, exception_date)
WHERE group_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_school_non_instr_group
ON school_non_instructional_days (exception_date, group_id)
WHERE group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_school_non_instr_date ON school_non_instructional_days (exception_date);

CREATE TABLE IF NOT EXISTS institution_settings (
    setting_key VARCHAR(64) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO institution_settings (setting_key, value)
VALUES ('circuit.enabled', 'true')
ON CONFLICT (setting_key) DO NOTHING;

-- Periodos academicos por escuela y ciclo escolar.
CREATE TABLE IF NOT EXISTS academic_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    school_year VARCHAR(20) NOT NULL,
    name VARCHAR(80) NOT NULL,
    order_index INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    weight NUMERIC(5,2) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PLANNED',
    closed_at TIMESTAMPTZ NULL,
    closed_by UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_academic_periods_status CHECK (status IN ('PLANNED','ACTIVE','CLOSED')),
    CONSTRAINT ck_academic_periods_dates CHECK (end_date >= start_date)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_academic_periods_order
    ON academic_periods (school_id, school_year, order_index);
CREATE INDEX IF NOT EXISTS ix_academic_periods_school_status
    ON academic_periods (school_id, status);

-- Actividades del docente (por grupo y materia) con ciclo de vida OPEN/CLOSED.
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
    subject_name VARCHAR(100) NOT NULL,
    period_id UUID NULL REFERENCES academic_periods(id) ON DELETE SET NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT NULL,
    period VARCHAR(50) NOT NULL,
    max_score NUMERIC(6,2) NOT NULL,
    due_date DATE NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    closed_at TIMESTAMPTZ NULL,
    closed_by UUID NULL,
    reopened_at TIMESTAMPTZ NULL,
    reopened_by UUID NULL,
    published_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_activities_status CHECK (status IN ('OPEN','CLOSED'))
);
CREATE INDEX IF NOT EXISTS ix_activities_group_status ON activities (group_id, status);
CREATE INDEX IF NOT EXISTS ix_activities_teacher ON activities (teacher_id);

-- Calificaciones por actividad (una fila por estudiante).
CREATE TABLE IF NOT EXISTS activity_grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    score NUMERIC(6,2) NOT NULL,
    notes TEXT NULL,
    graded_by UUID NULL,
    graded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_grades_activity_student
    ON activity_grades (activity_id, student_id);
CREATE INDEX IF NOT EXISTS ix_activity_grades_student ON activity_grades (student_id);

-- Boletines de periodo y finales.
CREATE TABLE IF NOT EXISTS report_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    school_year VARCHAR(20) NOT NULL,
    type VARCHAR(10) NOT NULL,
    period_id UUID NULL REFERENCES academic_periods(id) ON DELETE SET NULL,
    overall_average NUMERIC(6,2) NULL,
    failed_subjects_count INT NOT NULL DEFAULT 0,
    promotion_status VARCHAR(32) NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMPTZ NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_report_cards_type CHECK (type IN ('PERIOD','FINAL')),
    CONSTRAINT ck_report_cards_status CHECK (status IN ('DRAFT','PUBLISHED'))
);
CREATE INDEX IF NOT EXISTS ix_report_cards_student_year
    ON report_cards (student_id, school_year);
CREATE INDEX IF NOT EXISTS ix_report_cards_school_year
    ON report_cards (school_id, school_year);
CREATE UNIQUE INDEX IF NOT EXISTS uq_report_cards_period
    ON report_cards (student_id, period_id) WHERE period_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_report_cards_final
    ON report_cards (student_id, school_year) WHERE type = 'FINAL';

CREATE TABLE IF NOT EXISTS report_card_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_card_id UUID NOT NULL REFERENCES report_cards(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
    subject_name VARCHAR(100) NOT NULL,
    average NUMERIC(6,2) NOT NULL,
    activity_count INT NOT NULL DEFAULT 0,
    graded_count INT NOT NULL DEFAULT 0,
    is_passing BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_report_card_subjects_card_subject
    ON report_card_subjects (report_card_id, subject_id);

CREATE TABLE IF NOT EXISTS import_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kind VARCHAR(50) NOT NULL,
    total_rows INTEGER NOT NULL CHECK (total_rows >= 0),
    created_count INTEGER NOT NULL CHECK (created_count >= 0),
    error_count INTEGER NOT NULL CHECK (error_count >= 0),
    dry_run BOOLEAN NOT NULL DEFAULT FALSE,
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
    errors_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Visitas externas (administrativos/docentes invitan a visitantes externos)
CREATE TABLE IF NOT EXISTS external_visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    creator_role VARCHAR(20) NOT NULL,
    title VARCHAR(150) NOT NULL,
    purpose TEXT NOT NULL,
    visitor_name VARCHAR(150) NOT NULL,
    visitor_organization VARCHAR(150),
    location VARCHAR(200),
    visit_datetime TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 5 AND 600),
    audience_scope VARCHAR(16) NOT NULL CHECK (audience_scope IN ('SCHOOL','GROUPS','STUDENTS')),
    status VARCHAR(16) NOT NULL DEFAULT 'PROGRAMADA' CHECK (status IN ('PROGRAMADA','REPROGRAMADA','REALIZADA','CANCELADA')),
    cancellation_reason TEXT,
    previous_datetime TIMESTAMPTZ,
    reminded_24h_at TIMESTAMPTZ,
    reminded_1h_at TIMESTAMPTZ,
    auto_finalized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS external_visit_groups (
    visit_id UUID NOT NULL REFERENCES external_visits(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    PRIMARY KEY (visit_id, group_id)
);

CREATE TABLE IF NOT EXISTS external_visit_students (
    visit_id UUID NOT NULL REFERENCES external_visits(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    PRIMARY KEY (visit_id, student_id)
);

-- Reuniones internas (organizador invita a padres, docentes, administrativos)
CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    organizer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    organizer_role VARCHAR(20) NOT NULL,
    title VARCHAR(150) NOT NULL,
    purpose TEXT NOT NULL,
    modality VARCHAR(16) NOT NULL DEFAULT 'PRESENCIAL' CHECK (modality IN ('PRESENCIAL','VIRTUAL')),
    location VARCHAR(200),
    meeting_link VARCHAR(500),
    start_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes BETWEEN 5 AND 600),
    status VARCHAR(16) NOT NULL DEFAULT 'PROGRAMADA' CHECK (status IN ('PROGRAMADA','REPROGRAMADA','EN_CURSO','REALIZADA','CANCELADA')),
    cancellation_reason TEXT,
    previous_start_at TIMESTAMPTZ,
    reminded_24h_at TIMESTAMPTZ,
    reminded_1h_at TIMESTAMPTZ,
    auto_finalized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meeting_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    participant_role VARCHAR(20) NOT NULL,
    student_context_id UUID REFERENCES students(id) ON DELETE SET NULL,
    rsvp VARCHAR(16) NOT NULL DEFAULT 'PENDIENTE' CHECK (rsvp IN ('PENDIENTE','ACEPTADA','DECLINADA')),
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (meeting_id, user_id)
);

CREATE TABLE IF NOT EXISTS student_attention_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    severity attention_severity NOT NULL DEFAULT 'LEVE',
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notified_parent BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_attention_notes_student
ON student_attention_notes(student_id, occurred_at DESC);

-- Horarios de clase por grupo (franja semanal)
CREATE TABLE IF NOT EXISTS class_schedule_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    weekday SMALLINT NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    room VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_time > start_time)
);

-- Tokens Firebase Cloud Messaging por usuario (dispositivos)
CREATE TABLE IF NOT EXISTS user_fcm_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform VARCHAR(32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (token)
);

-- Auditoría y políticas de privacidad (cumplimiento)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(120) NOT NULL,
    entity_type VARCHAR(80),
    entity_id UUID,
    metadata JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS privacy_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version VARCHAR(32) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    effective_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_privacy_acceptances (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    policy_version VARCHAR(32) NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    PRIMARY KEY (user_id, policy_version)
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_access_events_user_date ON access_events(user_id, event_date);
CREATE INDEX IF NOT EXISTS idx_debts_student ON debts(student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance_records(student_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_import_jobs_kind_created ON import_jobs(kind, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_external_visits_school_datetime ON external_visits(school_id, visit_datetime);
CREATE INDEX IF NOT EXISTS ix_external_visits_created_by ON external_visits(created_by_user_id);
CREATE INDEX IF NOT EXISTS ix_external_visits_status ON external_visits(status);
CREATE INDEX IF NOT EXISTS ix_external_visit_groups_group ON external_visit_groups(group_id);
CREATE INDEX IF NOT EXISTS ix_external_visit_students_student ON external_visit_students(student_id);
CREATE INDEX IF NOT EXISTS ix_meetings_school_start ON meetings(school_id, start_at);
CREATE INDEX IF NOT EXISTS ix_meetings_organizer ON meetings(organizer_user_id);
CREATE INDEX IF NOT EXISTS ix_meetings_status ON meetings(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_meeting_participants_user ON meeting_participants(meeting_id, user_id);
CREATE INDEX IF NOT EXISTS ix_meeting_participants_user ON meeting_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_slots_group ON class_schedule_slots(group_id);
CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_user ON user_fcm_tokens(user_id);

-- Actualización de enum en bases ya creadas (si el tipo existía sin este valor). Requiere permiso de dueño del tipo.
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

ALTER TABLE circuit_requests
  ADD COLUMN IF NOT EXISTS parent_confirm_deadline_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS parent_receipt_confirmed_at TIMESTAMPTZ NULL;
