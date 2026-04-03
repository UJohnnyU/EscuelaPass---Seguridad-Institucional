import { MigrationInterface, QueryRunner } from 'typeorm';

export class InstitutionSettings1775800000000 implements MigrationInterface {
  name = 'InstitutionSettings1775800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS institution_settings (
        setting_key VARCHAR(64) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      INSERT INTO institution_settings (setting_key, value)
      VALUES ('circuit.enabled', 'true')
      ON CONFLICT (setting_key) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS institution_settings;`);
  }
}
