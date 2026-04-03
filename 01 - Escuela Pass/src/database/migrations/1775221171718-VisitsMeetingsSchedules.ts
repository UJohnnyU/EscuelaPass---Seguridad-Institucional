import { MigrationInterface, QueryRunner } from 'typeorm';

export class VisitsMeetingsSchedules1775221171718 implements MigrationInterface {
  name = 'VisitsMeetingsSchedules1775221171718';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE visit_request_status AS ENUM (
          'PENDIENTE', 'APROBADA', 'RECHAZADA', 'REALIZADA', 'CANCELADA'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE meeting_status AS ENUM (
          'PENDIENTE', 'CONFIRMADA', 'REALIZADA', 'CANCELADA'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
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
    `);
    await queryRunner.query(`
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
    `);
    await queryRunner.query(`
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
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_visit_requests_parent ON visit_requests(parent_id);`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_visit_requests_student ON visit_requests(student_id);`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_meetings_parent ON parent_teacher_meetings(parent_id);`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_meetings_teacher ON parent_teacher_meetings(teacher_id);`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_schedule_slots_group ON class_schedule_slots(group_id);`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS class_schedule_slots;`);
    await queryRunner.query(`DROP TABLE IF EXISTS parent_teacher_meetings;`);
    await queryRunner.query(`DROP TABLE IF EXISTS visit_requests;`);
    await queryRunner.query(`DROP TYPE IF EXISTS meeting_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS visit_request_status;`);
  }
}
