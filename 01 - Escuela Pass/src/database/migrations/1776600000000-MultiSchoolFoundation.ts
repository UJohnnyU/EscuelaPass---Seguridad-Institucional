import { MigrationInterface, QueryRunner } from 'typeorm';

export class MultiSchoolFoundation1776600000000 implements MigrationInterface {
  name = 'MultiSchoolFoundation1776600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS schools (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(160) NOT NULL UNIQUE,
        code VARCHAR(60) NOT NULL UNIQUE,
        status BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS school_id UUID NULL REFERENCES schools(id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_users_school_id
      ON users(school_id)
    `);

    await queryRunner.query(`
      INSERT INTO schools (name, code, status)
      VALUES ('Escuela principal', 'ESCUELA-PRINCIPAL', TRUE)
      ON CONFLICT (code) DO NOTHING
    `);

    await queryRunner.query(`
      UPDATE users
      SET school_id = s.id
      FROM schools s
      WHERE users.school_id IS NULL
        AND s.code = 'ESCUELA-PRINCIPAL'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_school_id`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS school_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS schools`);
  }
}
