import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserPhone1776300000000 implements MigrationInterface {
  name = 'UserPhone1776300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30) NULL`);
    await queryRunner.query(`
      UPDATE users u
      SET phone = sub.gen_phone
      FROM (
        SELECT
          id,
          '+52 55 5100 ' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::text, 4, '0') AS gen_phone
        FROM users
      ) sub
      WHERE u.id = sub.id AND (u.phone IS NULL OR TRIM(u.phone) = '')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS phone`);
  }
}
