import { MigrationInterface, QueryRunner } from 'typeorm';

export class SchoolStudentMatriculaPrefix1777800000000 implements MigrationInterface {
  name = 'SchoolStudentMatriculaPrefix1777800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE schools ADD COLUMN IF NOT EXISTS student_matricula_prefix varchar(20) NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE schools DROP COLUMN IF EXISTS student_matricula_prefix`);
  }
}
