import { MigrationInterface, QueryRunner } from 'typeorm';

export class SchoolCircuitEnabledByInstitution1777900000000 implements MigrationInterface {
  name = 'SchoolCircuitEnabledByInstitution1777900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE schools ADD COLUMN IF NOT EXISTS circuit_enabled BOOLEAN NOT NULL DEFAULT true`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE schools DROP COLUMN IF EXISTS circuit_enabled`);
  }
}
