import { MigrationInterface, QueryRunner } from 'typeorm';

export class SchoolShiftWindows1778400000000 implements MigrationInterface {
  name = 'SchoolShiftWindows1778400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS shift_matutino_start time NULL`);
    await queryRunner.query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS shift_matutino_end time NULL`);
    await queryRunner.query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS shift_vespertino_start time NULL`);
    await queryRunner.query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS shift_vespertino_end time NULL`);
    await queryRunner.query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS shift_nocturno_start time NULL`);
    await queryRunner.query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS shift_nocturno_end time NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE schools DROP COLUMN IF EXISTS shift_matutino_start`);
    await queryRunner.query(`ALTER TABLE schools DROP COLUMN IF EXISTS shift_matutino_end`);
    await queryRunner.query(`ALTER TABLE schools DROP COLUMN IF EXISTS shift_vespertino_start`);
    await queryRunner.query(`ALTER TABLE schools DROP COLUMN IF EXISTS shift_vespertino_end`);
    await queryRunner.query(`ALTER TABLE schools DROP COLUMN IF EXISTS shift_nocturno_start`);
    await queryRunner.query(`ALTER TABLE schools DROP COLUMN IF EXISTS shift_nocturno_end`);
  }
}
