import { MigrationInterface, QueryRunner } from 'typeorm';

export class SchoolInstitutionFields1776800000000 implements MigrationInterface {
  name = 'SchoolInstitutionFields1776800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS address VARCHAR(500)`);
    await queryRunner.query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS city VARCHAR(120)`);
    await queryRunner.query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS phone VARCHAR(80)`);
    await queryRunner.query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS email VARCHAR(200)`);
    await queryRunner.query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS director_name VARCHAR(200)`);
    await queryRunner.query(`ALTER TABLE schools ADD COLUMN IF NOT EXISTS motto VARCHAR(500)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE schools DROP COLUMN IF EXISTS motto`);
    await queryRunner.query(`ALTER TABLE schools DROP COLUMN IF EXISTS director_name`);
    await queryRunner.query(`ALTER TABLE schools DROP COLUMN IF EXISTS email`);
    await queryRunner.query(`ALTER TABLE schools DROP COLUMN IF EXISTS phone`);
    await queryRunner.query(`ALTER TABLE schools DROP COLUMN IF EXISTS city`);
    await queryRunner.query(`ALTER TABLE schools DROP COLUMN IF EXISTS address`);
  }
}
