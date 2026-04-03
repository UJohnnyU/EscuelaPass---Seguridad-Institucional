-- =============================================================
-- ESCUELA PASS - Esquema PostgreSQL v3
-- Ejecutar en base vacía (o revisar tipos/tablas antes de re-ejecutar)
-- Requiere: CREATE EXTENSION uuid-ossp; CREATE EXTENSION pgcrypto;
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

DO $$ BEGIN
  CREATE TYPE pickup_method AS ENUM (
    'VEHICULO_REGISTRADO', 'OTRO_VEHICULO', 'A_PIE', 'TRANSPORTE_PUBLICO', 'SOLO_CONSENTIMIENTO'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE circuit_status AS ENUM (
    'PENDIENTE', 'NOTIFICADO_LLEGADA', 'AUTORIZADO_SALIR', 'EN_CAMINO',
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
  CREATE TYPE visit_request_status AS ENUM (
    'PENDIENTE', 'APROBADA', 'RECHAZADA', 'REALIZADA', 'CANCELADA'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE meeting_status AS ENUM (
    'PENDIENTE', 'CONFIRMADA', 'REALIZADA', 'CANCELADA'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Usuarios
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    can_access_campus BOOLEAN NOT NULL DEFAULT FALSE,
    status BOOLEAN NOT NULL DEFAULT TRUE,
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (name, school_year)
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
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
    reason TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_school_non_instr_global
ON school_non_instructional_days (exception_date)
WHERE group_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_school_non_instr_group
ON school_non_instructional_days (exception_date, group_id)
WHERE group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_school_non_instr_date ON school_non_instructional_days (exception_date);

CREATE TABLE IF NOT EXISTS grades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
    subject VARCHAR(100) NOT NULL,
    period VARCHAR(50) NOT NULL,
    assessment_name VARCHAR(120) NOT NULL,
    score DECIMAL(5, 2) NOT NULL,
    max_score DECIMAL(5, 2) NOT NULL DEFAULT 100,
    notes TEXT,
    graded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    graded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (student_id, subject, period, assessment_name)
);

CREATE TABLE IF NOT EXISTS import_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kind VARCHAR(50) NOT NULL,
    total_rows INTEGER NOT NULL CHECK (total_rows >= 0),
    created_count INTEGER NOT NULL CHECK (created_count >= 0),
    error_count INTEGER NOT NULL CHECK (error_count >= 0),
    dry_run BOOLEAN NOT NULL DEFAULT FALSE,
    errors_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Visitas al plantel (solicitud del padre)
CREATE TABLE IF NOT EXISTS visit_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    visit_datetime TIMESTAMPTZ NOT NULL,
    reason TEXT,
    status visit_request_status NOT NULL DEFAULT 'PENDIENTE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Reuniones padre-docente
CREATE TABLE IF NOT EXISTS parent_teacher_meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    meeting_datetime TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes > 0 AND duration_minutes <= 480),
    topic VARCHAR(255),
    notes TEXT,
    status meeting_status NOT NULL DEFAULT 'PENDIENTE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

CREATE INDEX IF NOT EXISTS idx_access_events_user_date ON access_events(user_id, event_date);
CREATE INDEX IF NOT EXISTS idx_debts_student ON debts(student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance_records(student_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_group ON grades(group_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_kind_created ON import_jobs(kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visit_requests_parent ON visit_requests(parent_id);
CREATE INDEX IF NOT EXISTS idx_visit_requests_student ON visit_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_meetings_parent ON parent_teacher_meetings(parent_id);
CREATE INDEX IF NOT EXISTS idx_meetings_teacher ON parent_teacher_meetings(teacher_id);
CREATE INDEX IF NOT EXISTS idx_schedule_slots_group ON class_schedule_slots(group_id);
CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_user ON user_fcm_tokens(user_id);
