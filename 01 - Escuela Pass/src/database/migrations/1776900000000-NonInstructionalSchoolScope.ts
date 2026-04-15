import { MigrationInterface, QueryRunner } from 'typeorm';

/** Días globales (sin grupo) quedan ligados a una escuela para soportar multi-institución. */
export class NonInstructionalSchoolScope1776900000000 implements MigrationInterface {
  name = 'NonInstructionalSchoolScope1776900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE school_non_instructional_days
      ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE
    `);

    await queryRunner.query(`
      UPDATE school_non_instructional_days d
      SET school_id = g.school_id
      FROM groups g
      WHERE d.group_id = g.id AND d.school_id IS NULL
    `);

    await queryRunner.query(`
      UPDATE school_non_instructional_days d
      SET school_id = (SELECT id FROM schools ORDER BY name LIMIT 1)
      WHERE d.group_id IS NULL AND d.school_id IS NULL
    `);

    await queryRunner.query(`
      DELETE FROM school_non_instructional_days WHERE group_id IS NULL AND school_id IS NULL
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS uniq_school_non_instr_global`);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_school_non_instr_school_date
      ON school_non_instructional_days (school_id, exception_date)
      WHERE group_id IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE school_non_instructional_days
      ADD CONSTRAINT chk_non_instr_global_has_school
      CHECK (group_id IS NOT NULL OR school_id IS NOT NULL)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE school_non_instructional_days DROP CONSTRAINT IF EXISTS chk_non_instr_global_has_school
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS uniq_school_non_instr_school_date`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_school_non_instr_global
      ON school_non_instructional_days (exception_date)
      WHERE group_id IS NULL
    `);
    await queryRunner.query(`ALTER TABLE school_non_instructional_days DROP COLUMN IF EXISTS school_id`);
  }
}
