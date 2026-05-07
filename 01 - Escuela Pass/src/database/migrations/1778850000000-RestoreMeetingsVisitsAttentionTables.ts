import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Restaura tablas eliminadas en 1778700000000 que el producto PDF y la UI siguen usando:
 * reuniones (meetings), visitas institucionales (external_visits) y anotaciones de atención.
 */
export class RestoreMeetingsVisitsAttentionTables1778850000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TYPE attention_severity AS ENUM ('LEVE', 'MODERADA', 'GRAVE');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS external_visits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS external_visit_groups (
        visit_id UUID NOT NULL REFERENCES external_visits(id) ON DELETE CASCADE,
        group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        PRIMARY KEY (visit_id, group_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS external_visit_students (
        visit_id UUID NOT NULL REFERENCES external_visits(id) ON DELETE CASCADE,
        student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        PRIMARY KEY (visit_id, student_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS meetings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS meeting_participants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        participant_role VARCHAR(20) NOT NULL,
        student_context_id UUID REFERENCES students(id) ON DELETE SET NULL,
        rsvp VARCHAR(16) NOT NULL DEFAULT 'PENDIENTE' CHECK (rsvp IN ('PENDIENTE','ACEPTADA','DECLINADA','NO_ASISTIO')),
        responded_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (meeting_id, user_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS student_attention_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        severity attention_severity NOT NULL DEFAULT 'LEVE',
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        notified_parent BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_external_visits_school_datetime ON external_visits (school_id, visit_datetime)`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_external_visits_created_by ON external_visits (created_by_user_id)`
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_external_visits_status ON external_visits (status)`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_external_visit_groups_group ON external_visit_groups (group_id)`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_external_visit_students_student ON external_visit_students (student_id)`
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_meetings_school_start ON meetings (school_id, start_at)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_meetings_organizer ON meetings (organizer_user_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_meetings_status ON meetings (status)`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_meeting_participants_user ON meeting_participants (meeting_id, user_id)`
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_meeting_participants_user ON meeting_participants (user_id)`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_student_attention_notes_student ON student_attention_notes (student_id, occurred_at DESC)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_student_attention_notes_student`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_meeting_participants_user`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_meeting_participants_user`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_meetings_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_meetings_organizer`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_meetings_school_start`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_external_visit_students_student`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_external_visit_groups_group`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_external_visits_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_external_visits_created_by`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_external_visits_school_datetime`);
    await queryRunner.query(`DROP TABLE IF EXISTS student_attention_notes CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS meeting_participants CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS meetings CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS external_visit_students CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS external_visit_groups CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS external_visits CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS attention_severity`);
  }
}
