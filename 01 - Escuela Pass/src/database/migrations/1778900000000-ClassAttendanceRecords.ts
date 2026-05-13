import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClassAttendanceRecords1778900000000 implements MigrationInterface {
  name = 'ClassAttendanceRecords1778900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS class_attendance_records (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        class_session_id UUID NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
        attendance_date DATE NOT NULL,
        status attendance_status NOT NULL,
        is_justified BOOLEAN NOT NULL DEFAULT FALSE,
        notes TEXT,
        excuse_attachment_path VARCHAR(500),
        registered_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_class_attendance_student_session_date
          UNIQUE (student_id, class_session_id, attendance_date)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_class_att_student_date
      ON class_attendance_records(student_id, attendance_date)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_class_att_session_date
      ON class_attendance_records(class_session_id, attendance_date)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS ix_class_att_session_date`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_class_att_student_date`);
    await queryRunner.query(`DROP TABLE IF EXISTS class_attendance_records`);
  }
}
