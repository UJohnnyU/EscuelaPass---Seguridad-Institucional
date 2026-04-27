import { MigrationInterface, QueryRunner } from 'typeorm';

export class InstitutionalV13RuntimeSchema1778100000000 implements MigrationInterface {
  name = 'InstitutionalV13RuntimeSchema1778100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS lifecycle_status varchar(16)`);
    await queryRunner.query(`
      UPDATE teachers
      SET lifecycle_status = 'ACTIVO'
      WHERE lifecycle_status IS NULL OR btrim(lifecycle_status) = ''
    `);
    await queryRunner.query(`ALTER TABLE teachers ALTER COLUMN lifecycle_status SET DEFAULT 'ACTIVO'`);
    await queryRunner.query(`ALTER TABLE teachers ALTER COLUMN lifecycle_status SET NOT NULL`);
    await queryRunner.query(`
      DO $$
      BEGIN
        BEGIN
          ALTER TABLE teachers
            ADD CONSTRAINT ck_teachers_lifecycle_status
            CHECK (lifecycle_status IN ('ACTIVO', 'BAJA', 'TRASLADO', 'EGRESADO'));
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END;
      END $$;
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_teachers_lifecycle_status ON teachers (lifecycle_status)`);

    await queryRunner.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS school_id uuid`);
    await queryRunner.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS lifecycle_status varchar(16)`);
    await queryRunner.query(`
      UPDATE students
      SET lifecycle_status = 'ACTIVO'
      WHERE lifecycle_status IS NULL OR btrim(lifecycle_status) = ''
    `);
    await queryRunner.query(`ALTER TABLE students ALTER COLUMN lifecycle_status SET DEFAULT 'ACTIVO'`);
    await queryRunner.query(`ALTER TABLE students ALTER COLUMN lifecycle_status SET NOT NULL`);
    await queryRunner.query(`
      DO $$
      BEGIN
        BEGIN
          ALTER TABLE students
            ADD CONSTRAINT ck_students_lifecycle_status
            CHECK (lifecycle_status IN ('ACTIVO', 'BAJA', 'TRASLADO', 'EGRESADO'));
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END;
      END $$;
    `);
    await queryRunner.query(`
      UPDATE students s
      SET school_id = u.school_id
      FROM users u
      WHERE u.id = s.user_id
        AND s.school_id IS NULL
    `);
    await queryRunner.query(`ALTER TABLE students ALTER COLUMN school_id SET NOT NULL`);
    await queryRunner.query(`
      DO $$
      DECLARE con_name text;
      BEGIN
        SELECT c.conname
          INTO con_name
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = current_schema()
          AND t.relname = 'students'
          AND c.contype = 'u'
          AND array_length(c.conkey, 1) = 1
          AND (
            SELECT a.attname
            FROM pg_attribute a
            WHERE a.attrelid = c.conrelid
              AND a.attnum = c.conkey[1]
          ) = 'matricula'
        LIMIT 1;

        IF con_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE students DROP CONSTRAINT %I', con_name);
        END IF;
      END $$;
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_students_school_id ON students (school_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_students_lifecycle_status ON students (lifecycle_status)`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_students_school_matricula ON students (school_id, matricula)`);
    await queryRunner.query(`
      DO $$
      BEGIN
        BEGIN
          ALTER TABLE students
            ADD CONSTRAINT fk_students_school_id
            FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS teacher_lifecycle_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        from_status varchar(16) NOT NULL,
        to_status varchar(16) NOT NULL,
        reason varchar(240) NOT NULL,
        effective_date date NOT NULL,
        changed_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_teacher_lifecycle_events_from_status CHECK (from_status IN ('ACTIVO', 'BAJA', 'TRASLADO', 'EGRESADO')),
        CONSTRAINT ck_teacher_lifecycle_events_to_status CHECK (to_status IN ('ACTIVO', 'BAJA', 'TRASLADO', 'EGRESADO'))
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_teacher_lifecycle_events_teacher ON teacher_lifecycle_events (teacher_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_teacher_lifecycle_events_school_created ON teacher_lifecycle_events (school_id, created_at DESC)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS student_lifecycle_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        from_status varchar(16) NOT NULL,
        to_status varchar(16) NOT NULL,
        reason varchar(240) NOT NULL,
        effective_date date NOT NULL,
        changed_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_student_lifecycle_events_from_status CHECK (from_status IN ('ACTIVO', 'BAJA', 'TRASLADO', 'EGRESADO')),
        CONSTRAINT ck_student_lifecycle_events_to_status CHECK (to_status IN ('ACTIVO', 'BAJA', 'TRASLADO', 'EGRESADO'))
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_student_lifecycle_events_student ON student_lifecycle_events (student_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_student_lifecycle_events_school_created ON student_lifecycle_events (school_id, created_at DESC)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS debt_adjustments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        debt_id uuid NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
        school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        action_type varchar(32) NOT NULL,
        previous_amount numeric(10,2) NOT NULL,
        delta_amount numeric(10,2) NOT NULL,
        next_amount numeric(10,2) NOT NULL,
        reason varchar(300) NOT NULL,
        policy_cycle_date date NULL,
        changed_by_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
        metadata jsonb NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_debt_adjustments_debt_created ON debt_adjustments (debt_id, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_debt_adjustments_school_created ON debt_adjustments (school_id, created_at DESC)`);

    await queryRunner.query(`ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS class_session_id uuid NULL`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS class_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        academic_period_id uuid NOT NULL REFERENCES academic_periods(id) ON DELETE CASCADE,
        group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
        teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
        weekday smallint NOT NULL,
        start_time time NOT NULL,
        end_time time NOT NULL,
        room varchar(80) NULL,
        is_active boolean NOT NULL DEFAULT true,
        created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        updated_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_class_sessions_weekday CHECK (weekday BETWEEN 0 AND 6),
        CONSTRAINT ck_class_sessions_times CHECK (end_time > start_time)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_class_sessions_school_period_weekday ON class_sessions (school_id, academic_period_id, weekday)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_class_sessions_group ON class_sessions (group_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_class_sessions_teacher ON class_sessions (teacher_id)`);
    await queryRunner.query(`
      DO $$
      BEGIN
        BEGIN
          ALTER TABLE attendance_records
            ADD CONSTRAINT fk_attendance_records_class_session
            FOREIGN KEY (class_session_id) REFERENCES class_sessions(id) ON DELETE SET NULL;
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END;
      END $$;
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_attendance_records_class_session ON attendance_records (class_session_id)`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_class_sessions_exact
      ON class_sessions (
        school_id,
        academic_period_id,
        group_id,
        subject_id,
        teacher_id,
        weekday,
        start_time,
        end_time,
        COALESCE(room, '')
      )
    `);

    await queryRunner.query(`
      WITH period_choice AS (
        SELECT
          g.id AS group_id,
          g.school_id AS school_id,
          COALESCE(
            (
              SELECT ap.id FROM academic_periods ap
              WHERE ap.school_id = g.school_id AND ap.school_year = g.school_year AND ap.status = 'ACTIVE'
              ORDER BY ap.order_index ASC LIMIT 1
            ),
            (
              SELECT ap.id FROM academic_periods ap
              WHERE ap.school_id = g.school_id AND ap.school_year = g.school_year AND ap.status = 'PLANNED'
              ORDER BY ap.order_index ASC LIMIT 1
            ),
            (
              SELECT ap.id FROM academic_periods ap
              WHERE ap.school_id = g.school_id AND ap.school_year = g.school_year AND ap.status = 'CLOSED'
              ORDER BY ap.order_index DESC LIMIT 1
            )
          ) AS period_id
        FROM groups g
      )
      INSERT INTO class_sessions (
        school_id,
        academic_period_id,
        group_id,
        subject_id,
        teacher_id,
        weekday,
        start_time,
        end_time,
        room,
        is_active,
        created_by_user_id,
        updated_by_user_id,
        created_at,
        updated_at
      )
      SELECT
        pc.school_id,
        pc.period_id,
        css.group_id,
        css.subject_id,
        css.teacher_id,
        css.weekday,
        css.start_time,
        css.end_time,
        css.room,
        true,
        creator.user_id,
        creator.user_id,
        css.created_at,
        css.updated_at
      FROM class_schedule_slots css
      JOIN period_choice pc ON pc.group_id = css.group_id
      JOIN LATERAL (
        SELECT u.id AS user_id
        FROM users u
        WHERE u.school_id = pc.school_id
        ORDER BY CASE WHEN u.role = 'ADMIN' THEN 0 ELSE 1 END, u.created_at ASC
        LIMIT 1
      ) creator ON true
      WHERE pc.period_id IS NOT NULL
        AND css.subject_id IS NOT NULL
        AND css.teacher_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM class_sessions cs
          WHERE cs.school_id = pc.school_id
            AND cs.academic_period_id = pc.period_id
            AND cs.group_id = css.group_id
            AND cs.subject_id = css.subject_id
            AND cs.teacher_id = css.teacher_id
            AND cs.weekday = css.weekday
            AND cs.start_time = css.start_time
            AND cs.end_time = css.end_time
            AND COALESCE(cs.room, '') = COALESCE(css.room, '')
        )
    `);

    await queryRunner.query(`ALTER TABLE circuit_requests ADD COLUMN IF NOT EXISTS pickup_vehicle_description varchar(120) NULL`);
    await queryRunner.query(`ALTER TABLE circuit_requests ADD COLUMN IF NOT EXISTS pickup_notes varchar(240) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE circuit_requests DROP COLUMN IF EXISTS pickup_notes`);
    await queryRunner.query(`ALTER TABLE circuit_requests DROP COLUMN IF EXISTS pickup_vehicle_description`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_class_sessions_exact`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_attendance_records_class_session`);
    await queryRunner.query(`ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS fk_attendance_records_class_session`);
    await queryRunner.query(`ALTER TABLE attendance_records DROP COLUMN IF EXISTS class_session_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS class_sessions`);
    await queryRunner.query(`DROP TABLE IF EXISTS debt_adjustments`);
    await queryRunner.query(`DROP TABLE IF EXISTS student_lifecycle_events`);
    await queryRunner.query(`DROP TABLE IF EXISTS teacher_lifecycle_events`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_students_school_matricula`);
    await queryRunner.query(`ALTER TABLE students DROP CONSTRAINT IF EXISTS fk_students_school_id`);
    await queryRunner.query(`ALTER TABLE students DROP CONSTRAINT IF EXISTS ck_students_lifecycle_status`);
    await queryRunner.query(`ALTER TABLE teachers DROP CONSTRAINT IF EXISTS ck_teachers_lifecycle_status`);
    await queryRunner.query(`ALTER TABLE students DROP COLUMN IF EXISTS lifecycle_status`);
    await queryRunner.query(`ALTER TABLE teachers DROP COLUMN IF EXISTS lifecycle_status`);
  }
}
