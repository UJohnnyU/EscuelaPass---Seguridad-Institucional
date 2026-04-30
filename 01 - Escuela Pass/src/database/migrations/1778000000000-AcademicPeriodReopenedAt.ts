import { MigrationInterface, QueryRunner } from 'typeorm';

export class AcademicPeriodReopenedAt1778000000000 implements MigrationInterface {
  name = 'AcademicPeriodReopenedAt1778000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "academic_periods" ADD COLUMN IF NOT EXISTS "reopened_at" TIMESTAMP WITH TIME ZONE NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "academic_periods" DROP COLUMN IF EXISTS "reopened_at"`);
  }
}
