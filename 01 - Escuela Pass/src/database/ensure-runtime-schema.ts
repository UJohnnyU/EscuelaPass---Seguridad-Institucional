import { DataSource } from 'typeorm';

/**
 * Aplica al arranque cambios de esquema incrementales para entornos donde las migraciones
 * formales (npm run migration:run) no se ejecutan automáticamente (p. ej. Railway con start:prod).
 *
 * Cada sentencia es idempotente: usa IF NOT EXISTS o comprobaciones previas para no romper
 * instalaciones que ya tengan el esquema al día.
 *
 * Convive con la cadena oficial de migraciones en `src/database/migrations/`; la estrategia de BD
 * (solo migraciones vs. `db:apply` v4) se describe en `docs/technical-setup.md`.
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

    await runner.query(`DROP TABLE IF EXISTS parent_teacher_meetings CASCADE`);
    await runner.query(`DROP TYPE IF EXISTS meeting_status CASCADE`);

    await runner.query(`
      CREATE TABLE IF NOT EXISTS external_visits (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        creator_role varchar(20) NOT NULL,
        title varchar(150) NOT NULL,
        purpose text NOT NULL,
        visitor_name varchar(150) NOT NULL,
        visitor_organization varchar(150) NULL,
        location varchar(200) NULL,
        visit_datetime timestamptz NOT NULL,
        duration_minutes int NOT NULL DEFAULT 60,
        audience_scope varchar(16) NOT NULL,
        status varchar(16) NOT NULL DEFAULT 'PROGRAMADA',
        cancellation_reason text NULL,
        previous_datetime timestamptz NULL,
        reminded_24h_at timestamptz NULL,
        reminded_1h_at timestamptz NULL,
        auto_finalized_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_external_visits_scope CHECK (audience_scope IN ('SCHOOL','GROUPS','STUDENTS')),
        CONSTRAINT ck_external_visits_status CHECK (status IN ('PROGRAMADA','REPROGRAMADA','REALIZADA','CANCELADA')),
        CONSTRAINT ck_external_visits_duration CHECK (duration_minutes BETWEEN 5 AND 600)
      )
    `);
    await runner.query(
      `CREATE INDEX IF NOT EXISTS ix_external_visits_school_datetime ON external_visits (school_id, visit_datetime)`
    );
    await runner.query(
      `CREATE INDEX IF NOT EXISTS ix_external_visits_created_by ON external_visits (created_by_user_id)`
    );
    await runner.query(
      `CREATE INDEX IF NOT EXISTS ix_external_visits_status ON external_visits (status)`
    );

    await runner.query(`
      CREATE TABLE IF NOT EXISTS external_visit_groups (
        visit_id uuid NOT NULL REFERENCES external_visits(id) ON DELETE CASCADE,
        group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        PRIMARY KEY (visit_id, group_id)
      )
    `);
    await runner.query(
      `CREATE INDEX IF NOT EXISTS ix_external_visit_groups_group ON external_visit_groups (group_id)`
    );

    await runner.query(`
      CREATE TABLE IF NOT EXISTS external_visit_students (
        visit_id uuid NOT NULL REFERENCES external_visits(id) ON DELETE CASCADE,
        student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        PRIMARY KEY (visit_id, student_id)
      )
    `);
    await runner.query(
      `CREATE INDEX IF NOT EXISTS ix_external_visit_students_student ON external_visit_students (student_id)`
    );

    await runner.query(`
      CREATE TABLE IF NOT EXISTS meetings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        organizer_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        organizer_role varchar(20) NOT NULL,
        title varchar(150) NOT NULL,
        purpose text NOT NULL,
        modality varchar(16) NOT NULL DEFAULT 'PRESENCIAL',
        location varchar(200) NULL,
        meeting_link varchar(500) NULL,
        start_at timestamptz NOT NULL,
        duration_minutes int NOT NULL DEFAULT 30,
        status varchar(16) NOT NULL DEFAULT 'PROGRAMADA',
        cancellation_reason text NULL,
        previous_start_at timestamptz NULL,
        reminded_24h_at timestamptz NULL,
        reminded_1h_at timestamptz NULL,
        auto_finalized_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_meetings_modality CHECK (modality IN ('PRESENCIAL','VIRTUAL')),
        CONSTRAINT ck_meetings_status CHECK (status IN ('PROGRAMADA','REPROGRAMADA','EN_CURSO','REALIZADA','CANCELADA')),
        CONSTRAINT ck_meetings_duration CHECK (duration_minutes BETWEEN 5 AND 600)
      )
    `);
    await runner.query(
      `CREATE INDEX IF NOT EXISTS ix_meetings_school_start ON meetings (school_id, start_at)`
    );
    await runner.query(
      `CREATE INDEX IF NOT EXISTS ix_meetings_organizer ON meetings (organizer_user_id)`
    );
    await runner.query(
      `CREATE INDEX IF NOT EXISTS ix_meetings_status ON meetings (status)`
    );

    await runner.query(`
      CREATE TABLE IF NOT EXISTS meeting_participants (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        participant_role varchar(20) NOT NULL,
        student_context_id uuid NULL REFERENCES students(id) ON DELETE SET NULL,
        rsvp varchar(16) NOT NULL DEFAULT 'PENDIENTE',
        responded_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_meeting_participants_rsvp CHECK (rsvp IN ('PENDIENTE','ACEPTADA','DECLINADA'))
      )
    `);
    await runner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_meeting_participants_user ON meeting_participants (meeting_id, user_id)`
    );
    await runner.query(
      `CREATE INDEX IF NOT EXISTS ix_meeting_participants_user ON meeting_participants (user_id)`
    );

    await runner.query(`
      CREATE TABLE IF NOT EXISTS admin_reports (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        assigned_admin_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
        type varchar(16) NOT NULL DEFAULT 'OTRO',
        subject varchar(160) NOT NULL,
        message text NOT NULL,
        status varchar(16) NOT NULL DEFAULT 'PENDIENTE',
        resolved_by_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
        resolved_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_admin_reports_type CHECK (type IN ('ERROR','SUGERENCIA','PETICION','OTRO')),
        CONSTRAINT ck_admin_reports_status CHECK (status IN ('PENDIENTE','EN_PROCESO','RESUELTO'))
      )
    `);
    await runner.query(
      `CREATE INDEX IF NOT EXISTS ix_admin_reports_school_status ON admin_reports (school_id, status)`
    );
    await runner.query(
      `CREATE INDEX IF NOT EXISTS ix_admin_reports_created_by ON admin_reports (created_by_user_id)`
    );

    await runner.query(`
      CREATE TABLE IF NOT EXISTS admin_report_comments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id uuid NOT NULL REFERENCES admin_reports(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        message text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await runner.query(
      `CREATE INDEX IF NOT EXISTS ix_admin_report_comments_report ON admin_report_comments (report_id, created_at)`
    );
    await runner.query(`
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
    await runner.query(
      `CREATE INDEX IF NOT EXISTS ix_debt_adjustments_debt_created ON debt_adjustments (debt_id, created_at DESC)`
    );
    await runner.query(
      `CREATE INDEX IF NOT EXISTS ix_debt_adjustments_school_created ON debt_adjustments (school_id, created_at DESC)`
    );

    await runner.query(`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS code varchar(30)`);
    await runner.query(`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS education_level varchar(80) NULL`);
    await runner.query(`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS grade_scope varchar(80) NULL`);
    await runner.query(`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS area varchar(80) NULL`);
    await runner.query(`UPDATE subjects SET code = id::text WHERE code IS NULL OR trim(code) = ''`);
    await runner.query(`ALTER TABLE subjects ALTER COLUMN code SET NOT NULL`);
    await runner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_subjects_school_code_ci ON subjects (school_id, lower(code))`
    );

    await runner.query(`
      CREATE TABLE IF NOT EXISTS teacher_subjects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await runner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_subjects_teacher_subject ON teacher_subjects (teacher_id, subject_id)`
    );
    await runner.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS lifecycle_status varchar(16)`);
    await runner.query(`
      UPDATE teachers
      SET lifecycle_status = 'ACTIVO'
      WHERE lifecycle_status IS NULL OR btrim(lifecycle_status) = ''
    `);
    await runner.query(`ALTER TABLE teachers ALTER COLUMN lifecycle_status SET DEFAULT 'ACTIVO'`);
    await runner.query(`ALTER TABLE teachers ALTER COLUMN lifecycle_status SET NOT NULL`);
    await runner.query(`
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
    await runner.query(`CREATE INDEX IF NOT EXISTS ix_teachers_lifecycle_status ON teachers (lifecycle_status)`);
    await runner.query(`
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
    await runner.query(
      `CREATE INDEX IF NOT EXISTS ix_teacher_lifecycle_events_teacher ON teacher_lifecycle_events (teacher_id)`
    );
    await runner.query(
      `CREATE INDEX IF NOT EXISTS ix_teacher_lifecycle_events_school_created ON teacher_lifecycle_events (school_id, created_at DESC)`
    );

    await runner.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS school_id uuid`);
    await runner.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS lifecycle_status varchar(16)`);
    await runner.query(`
      UPDATE students
      SET lifecycle_status = 'ACTIVO'
      WHERE lifecycle_status IS NULL OR btrim(lifecycle_status) = ''
    `);
    await runner.query(`ALTER TABLE students ALTER COLUMN lifecycle_status SET DEFAULT 'ACTIVO'`);
    await runner.query(`ALTER TABLE students ALTER COLUMN lifecycle_status SET NOT NULL`);
    await runner.query(`
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
    await runner.query(`
      UPDATE students s
      SET school_id = u.school_id
      FROM users u
      WHERE u.id = s.user_id
        AND s.school_id IS NULL
    `);
    await runner.query(`ALTER TABLE students ALTER COLUMN school_id SET NOT NULL`);
    await runner.query(`
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
          AND (
            array_length(c.conkey, 1) = 1
            AND (
              SELECT a.attname
              FROM pg_attribute a
              WHERE a.attrelid = c.conrelid
                AND a.attnum = c.conkey[1]
            ) = 'matricula'
          )
        LIMIT 1;

        IF con_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE students DROP CONSTRAINT %I', con_name);
        END IF;
      END $$;
    `);
    await runner.query(`CREATE INDEX IF NOT EXISTS ix_students_school_id ON students (school_id)`);
    await runner.query(`CREATE INDEX IF NOT EXISTS ix_students_lifecycle_status ON students (lifecycle_status)`);
    await runner.query(`
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
    await runner.query(
      `CREATE INDEX IF NOT EXISTS ix_student_lifecycle_events_student ON student_lifecycle_events (student_id)`
    );
    await runner.query(
      `CREATE INDEX IF NOT EXISTS ix_student_lifecycle_events_school_created ON student_lifecycle_events (school_id, created_at DESC)`
    );
    await runner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_students_school_matricula ON students (school_id, matricula)`
    );
    await runner.query(`
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

    await runner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_path VARCHAR(500) NULL`);
    await runner.query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS logo_path VARCHAR(500) NULL`);
    await runner.query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS student_matricula_prefix VARCHAR(20) NULL`);
    await runner.query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS circuit_enabled BOOLEAN NOT NULL DEFAULT true`);
    await runner.query(`ALTER TABLE schools DROP COLUMN IF EXISTS circuit_requires_early_pickup_approval`);
    await runner.query(`DROP TABLE IF EXISTS visit_requests CASCADE`);
    await runner.query(`DROP TYPE IF EXISTS visit_request_status`);
    await runner.query(`ALTER TABLE circuit_requests ADD COLUMN IF NOT EXISTS pickup_vehicle_description varchar(120) NULL`);
    await runner.query(`ALTER TABLE circuit_requests ADD COLUMN IF NOT EXISTS pickup_notes varchar(240) NULL`);

    await runner.query(
      `ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS excuse_attachment_path VARCHAR(500) NULL`
    );
    await runner.query(
      `ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS class_session_id uuid NULL`
    );

    await runner.query(`
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
    await runner.query(
      `CREATE INDEX IF NOT EXISTS ix_class_sessions_school_period_weekday ON class_sessions (school_id, academic_period_id, weekday)`
    );
    await runner.query(
      `CREATE INDEX IF NOT EXISTS ix_class_sessions_group ON class_sessions (group_id)`
    );
    await runner.query(
      `CREATE INDEX IF NOT EXISTS ix_class_sessions_teacher ON class_sessions (teacher_id)`
    );
    await runner.query(`
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
    await runner.query(
      `CREATE INDEX IF NOT EXISTS ix_attendance_records_class_session ON attendance_records (class_session_id)`
    );
    await runner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_class_sessions_exact
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
       )`
    );
    await runner.query(`
      WITH period_choice AS (
        SELECT
          g.id AS group_id,
          g.school_id AS school_id,
          COALESCE(
            (
              SELECT ap.id
              FROM academic_periods ap
              WHERE ap.school_id = g.school_id
                AND ap.school_year = g.school_year
                AND ap.status = 'ACTIVE'
              ORDER BY ap.order_index ASC
              LIMIT 1
            ),
            (
              SELECT ap.id
              FROM academic_periods ap
              WHERE ap.school_id = g.school_id
                AND ap.school_year = g.school_year
                AND ap.status = 'PLANNED'
              ORDER BY ap.order_index ASC
              LIMIT 1
            ),
            (
              SELECT ap.id
              FROM academic_periods ap
              WHERE ap.school_id = g.school_id
                AND ap.school_year = g.school_year
                AND ap.status = 'CLOSED'
              ORDER BY ap.order_index DESC
              LIMIT 1
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
  } finally {
    await runner.release();
  }
}
