import { MigrationInterface, QueryRunner } from 'typeorm';

export class SchoolMaxGradeScale1777000000000 implements MigrationInterface {
  name = 'SchoolMaxGradeScale1777000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE schools ADD COLUMN IF NOT EXISTS max_grade_scale DECIMAL(5,2) NOT NULL DEFAULT 100.00`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE schools DROP COLUMN IF EXISTS max_grade_scale`);
  }
}
