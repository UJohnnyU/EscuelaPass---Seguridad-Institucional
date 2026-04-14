import { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendanceJustification1776500000000 implements MigrationInterface {
  name = 'AttendanceJustification1776500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE attendance_records
      ADD COLUMN IF NOT EXISTS is_justified BOOLEAN NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE attendance_records
      DROP COLUMN IF EXISTS is_justified
    `);
  }
}

