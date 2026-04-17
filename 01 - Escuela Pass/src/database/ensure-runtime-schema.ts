import { DataSource } from 'typeorm';

/**
 * Aplica al arranque cambios de esquema incrementales para entornos donde las migraciones
 * formales (npm run migration:run) no se ejecutan automáticamente (p. ej. Railway con start:prod).
 *
 * Cada sentencia es idempotente: usa IF NOT EXISTS o comprobaciones previas para no romper
 * instalaciones que ya tengan el esquema al día.
 */
export async function ensureRuntimeSchema(dataSource: DataSource): Promise<void> {
  const runner = dataSource.createQueryRunner();
  try {
    await runner.connect();

    await runner.query(`
      CREATE TABLE IF NOT EXISTS activities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
        subject_name varchar(100) NOT NULL,
        title varchar(150) NOT NULL,
        description text NULL,
        period varchar(50) NOT NULL,
        max_score numeric(6,2) NOT NULL,
        due_date date NULL,
        status varchar(16) NOT NULL DEFAULT 'OPEN',
        closed_at timestamptz NULL,
        closed_by uuid NULL,
        reopened_at timestamptz NULL,
        reopened_by uuid NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_activities_status CHECK (status IN ('OPEN','CLOSED'))
      )
    `);
    await runner.query(
      `CREATE INDEX IF NOT EXISTS ix_activities_group_status ON activities (group_id, status)`
    );
    await runner.query(
      `CREATE INDEX IF NOT EXISTS ix_activities_teacher ON activities (teacher_id)`
    );

    await runner.query(`
      CREATE TABLE IF NOT EXISTS activity_grades (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
        student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        score numeric(6,2) NOT NULL,
        notes text NULL,
        graded_by uuid NULL,
        graded_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await runner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_grades_activity_student ON activity_grades (activity_id, student_id)`
    );
    await runner.query(
      `CREATE INDEX IF NOT EXISTS ix_activity_grades_student ON activity_grades (student_id)`
    );

    await runner.query(
      `ALTER TABLE schools ADD COLUMN IF NOT EXISTS max_grade_scale NUMERIC(5,2) NOT NULL DEFAULT 100.00`
    );
    await runner.query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,8)`);
    await runner.query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS longitude NUMERIC(11,8)`);
    await runner.query(
      `ALTER TABLE schools ADD COLUMN IF NOT EXISTS passing_grade NUMERIC(5,2) NOT NULL DEFAULT 0`
    );
    await runner.query(
      `ALTER TABLE schools ADD COLUMN IF NOT EXISTS min_failed_subjects_to_repeat INT NOT NULL DEFAULT 3`
    );

    await runner.query(
      `ALTER TABLE activities ADD COLUMN IF NOT EXISTS period_id uuid NULL`
    );
    await runner.query(
      `ALTER TABLE activities ADD COLUMN IF NOT EXISTS published_at timestamptz NULL`
    );

    await runner.query(`
      CREATE TABLE IF NOT EXISTS academic_periods (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        school_year varchar(20) NOT NULL,
        name varchar(80) NOT NULL,
        order_index int NOT NULL,
        start_date date NOT NULL,
        end_date date NOT NULL,
        weight numeric(5,2) NOT NULL,
        status varchar(16) NOT NULL DEFAULT 'PLANNED',
        closed_at timestamptz NULL,
        closed_by uuid NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_academic_periods_status CHECK (status IN ('PLANNED','ACTIVE','CLOSED')),
        CONSTRAINT ck_academic_periods_dates CHECK (end_date >= start_date)
      )
    `);
    await runner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_academic_periods_order ON academic_periods (school_id, school_year, order_index)`
    );
    await runner.query(
      `CREATE INDEX IF NOT EXISTS ix_academic_periods_school_status ON academic_periods (school_id, status)`
    );

    await runner.query(`
      CREATE TABLE IF NOT EXISTS report_cards (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        school_year varchar(20) NOT NULL,
        type varchar(10) NOT NULL,
        period_id uuid NULL REFERENCES academic_periods(id) ON DELETE SET NULL,
        overall_average numeric(6,2) NULL,
        failed_subjects_count int NOT NULL DEFAULT 0,
        promotion_status varchar(32) NULL,
        generated_at timestamptz NOT NULL DEFAULT now(),
        published_at timestamptz NULL,
        status varchar(16) NOT NULL DEFAULT 'DRAFT',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_report_cards_type CHECK (type IN ('PERIOD','FINAL')),
        CONSTRAINT ck_report_cards_status CHECK (status IN ('DRAFT','PUBLISHED'))
      )
    `);
    await runner.query(
      `CREATE INDEX IF NOT EXISTS ix_report_cards_student_year ON report_cards (student_id, school_year)`
    );
    await runner.query(
      `CREATE INDEX IF NOT EXISTS ix_report_cards_school_year ON report_cards (school_id, school_year)`
    );
    await runner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_report_cards_period ON report_cards (student_id, period_id) WHERE period_id IS NOT NULL`
    );
    await runner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_report_cards_final ON report_cards (student_id, school_year) WHERE type = 'FINAL'`
    );

    await runner.query(`
      CREATE TABLE IF NOT EXISTS report_card_subjects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        report_card_id uuid NOT NULL REFERENCES report_cards(id) ON DELETE CASCADE,
        subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
        subject_name varchar(100) NOT NULL,
        average numeric(6,2) NOT NULL,
        activity_count int NOT NULL DEFAULT 0,
        graded_count int NOT NULL DEFAULT 0,
        is_passing boolean NOT NULL DEFAULT false
      )
    `);
    await runner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_report_card_subjects_card_subject ON report_card_subjects (report_card_id, subject_id)`
    );

    await runner.query(`DROP TABLE IF EXISTS grades CASCADE`);
  } finally {
    await runner.release();
  }
}
