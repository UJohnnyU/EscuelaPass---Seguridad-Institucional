import { MigrationInterface, QueryRunner } from 'typeorm';

export class SchoolScopedAcademicData1776700000000 implements MigrationInterface {
  name = 'SchoolScopedAcademicData1776700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE groups
      ADD COLUMN IF NOT EXISTS school_id UUID NULL REFERENCES schools(id) ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE subjects
      ADD COLUMN IF NOT EXISTS school_id UUID NULL REFERENCES schools(id) ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE import_jobs
      ADD COLUMN IF NOT EXISTS school_id UUID NULL REFERENCES schools(id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_groups_school ON groups(school_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_subjects_school ON subjects(school_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_import_jobs_school ON import_jobs(school_id)
    `);

    await queryRunner.query(`
      UPDATE groups g
      SET school_id = u.school_id
      FROM students s
      JOIN users u ON u.id = s.user_id
      WHERE s.group_id = g.id
        AND g.school_id IS NULL
        AND u.school_id IS NOT NULL
    `);
    await queryRunner.query(`
      UPDATE groups
      SET school_id = (SELECT id FROM schools ORDER BY created_at ASC LIMIT 1)
      WHERE school_id IS NULL
    `);

    await queryRunner.query(`
      UPDATE subjects
      SET school_id = (SELECT id FROM schools ORDER BY created_at ASC LIMIT 1)
      WHERE school_id IS NULL
    `);

    await queryRunner.query(`ALTER TABLE groups ALTER COLUMN school_id SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE subjects ALTER COLUMN school_id SET NOT NULL`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_subjects_school_name
      ON subjects(school_id, lower(name))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_subjects_school_name`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_import_jobs_school`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_subjects_school`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_groups_school`);
    await queryRunner.query(`ALTER TABLE import_jobs DROP COLUMN IF EXISTS school_id`);
    await queryRunner.query(`ALTER TABLE subjects DROP COLUMN IF EXISTS school_id`);
    await queryRunner.query(`ALTER TABLE groups DROP COLUMN IF EXISTS school_id`);
  }
}
