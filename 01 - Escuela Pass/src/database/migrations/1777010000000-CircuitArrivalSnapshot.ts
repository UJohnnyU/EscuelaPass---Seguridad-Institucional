import { MigrationInterface, QueryRunner } from 'typeorm';

export class CircuitArrivalSnapshot1777010000000 implements MigrationInterface {
  name = 'CircuitArrivalSnapshot1777010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE circuit_requests ADD COLUMN IF NOT EXISTS arrival_snapshot_latitude NUMERIC(10,8) NULL`
    );
    await queryRunner.query(
      `ALTER TABLE circuit_requests ADD COLUMN IF NOT EXISTS arrival_snapshot_longitude NUMERIC(11,8) NULL`
    );
    await queryRunner.query(
      `ALTER TABLE circuit_requests ADD COLUMN IF NOT EXISTS arrival_snapshot_at TIMESTAMPTZ NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE circuit_requests DROP COLUMN IF EXISTS arrival_snapshot_at`);
    await queryRunner.query(`ALTER TABLE circuit_requests DROP COLUMN IF EXISTS arrival_snapshot_longitude`);
    await queryRunner.query(`ALTER TABLE circuit_requests DROP COLUMN IF EXISTS arrival_snapshot_latitude`);
  }
}
