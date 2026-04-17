import { MigrationInterface, QueryRunner } from 'typeorm';

export class TeacherActivities1777030000000 implements MigrationInterface {
  name = 'TeacherActivities1777030000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS activities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        teacher_id uuid NOT NULL,
        group_id uuid NOT NULL,
        subject_id uuid NOT NULL,
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
        CONSTRAINT fk_activities_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
        CONSTRAINT fk_activities_group FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        CONSTRAINT fk_activities_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE RESTRICT,
        CONSTRAINT ck_activities_status CHECK (status IN ('OPEN','CLOSED'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_activities_group_status ON activities (group_id, status)`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_activities_teacher ON activities (teacher_id)`
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS activity_grades (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        activity_id uuid NOT NULL,
        student_id uuid NOT NULL,
        score numeric(6,2) NOT NULL,
        notes text NULL,
        graded_by uuid NULL,
        graded_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_activity_grades_activity FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
        CONSTRAINT fk_activity_grades_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_grades_activity_student ON activity_grades (activity_id, student_id)`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_activity_grades_student ON activity_grades (student_id)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS activity_grades`);
    await queryRunner.query(`DROP TABLE IF EXISTS activities`);
  }
}
