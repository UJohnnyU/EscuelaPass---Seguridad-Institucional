import { MigrationInterface, QueryRunner } from 'typeorm';

export class SchoolNonInstructionalDays1775700000000 implements MigrationInterface {
  name = 'SchoolNonInstructionalDays1775700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS school_non_instructional_days (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        exception_date DATE NOT NULL,
        group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
        reason TEXT,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_school_non_instr_global
      ON school_non_instructional_days (exception_date)
      WHERE group_id IS NULL;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_school_non_instr_group
      ON school_non_instructional_days (exception_date, group_id)
      WHERE group_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_school_non_instr_date
      ON school_non_instructional_days (exception_date);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_school_non_instr_date;`);
    await queryRunner.query(`DROP INDEX IF EXISTS uniq_school_non_instr_group;`);
    await queryRunner.query(`DROP INDEX IF EXISTS uniq_school_non_instr_global;`);
    await queryRunner.query(`DROP TABLE IF EXISTS school_non_instructional_days;`);
  }
}
