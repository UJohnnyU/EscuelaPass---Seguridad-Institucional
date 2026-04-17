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
  } finally {
    await runner.release();
  }
}
