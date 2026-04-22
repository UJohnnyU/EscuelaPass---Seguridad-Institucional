import { MigrationInterface, QueryRunner } from 'typeorm';

export class SubjectsAndTeacherSpecialties1777600000000 implements MigrationInterface {
  name = 'SubjectsAndTeacherSpecialties1777600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS code varchar(30)`);
    await queryRunner.query(`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS education_level varchar(80) NULL`);
    await queryRunner.query(`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS grade_scope varchar(80) NULL`);
    await queryRunner.query(`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS area varchar(80) NULL`);
    await queryRunner.query(`
      UPDATE subjects
      SET code = CONCAT('SUB-', UPPER(SUBSTRING(REPLACE(id::text, '-', '') FROM 1 FOR 12)))
      WHERE code IS NULL OR trim(code) = ''
    `);
    await queryRunner.query(`ALTER TABLE subjects ALTER COLUMN code SET NOT NULL`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_subjects_school_code_ci ON subjects (school_id, lower(code))`
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS teacher_subjects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_subjects_teacher_subject ON teacher_subjects (teacher_id, subject_id)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_teacher_subjects_teacher_subject`);
    await queryRunner.query(`DROP TABLE IF EXISTS teacher_subjects`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_subjects_school_code_ci`);
    await queryRunner.query(`ALTER TABLE subjects DROP COLUMN IF EXISTS area`);
    await queryRunner.query(`ALTER TABLE subjects DROP COLUMN IF EXISTS grade_scope`);
    await queryRunner.query(`ALTER TABLE subjects DROP COLUMN IF EXISTS education_level`);
    await queryRunner.query(`ALTER TABLE subjects DROP COLUMN IF EXISTS code`);
  }
}
