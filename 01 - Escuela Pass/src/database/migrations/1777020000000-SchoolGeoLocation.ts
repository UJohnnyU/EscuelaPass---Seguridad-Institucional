import { MigrationInterface, QueryRunner } from 'typeorm';

export class SchoolGeoLocation1777020000000 implements MigrationInterface {
  name = 'SchoolGeoLocation1777020000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE schools ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,8)`
    );
    await queryRunner.query(
      `ALTER TABLE schools ADD COLUMN IF NOT EXISTS longitude NUMERIC(11,8)`
    );
    await queryRunner.query(
      `UPDATE schools
       SET latitude = COALESCE(latitude, 4.60970000),
           longitude = COALESCE(longitude, -74.08170000)`
    );
    await queryRunner.query(`ALTER TABLE schools ALTER COLUMN latitude SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE schools ALTER COLUMN longitude SET NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE schools DROP COLUMN IF EXISTS longitude`);
    await queryRunner.query(`ALTER TABLE schools DROP COLUMN IF EXISTS latitude`);
  }
}
