import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cierre sin confirmación final del padre + plazo para confirmar recibimiento en EN_CAMINO.
 */
export class CircuitParentConfirmDeadline1776200000000 implements MigrationInterface {
  name = 'CircuitParentConfirmDeadline1776200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const existsEnum = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'circuit_status' AND e.enumlabel = 'CERRADO_SIN_CONFIRMACION_PADRE'
      ) AS ok
    `);
    if (existsEnum[0]?.ok !== true) {
      try {
        await queryRunner.query(
          `ALTER TYPE circuit_status ADD VALUE 'CERRADO_SIN_CONFIRMACION_PADRE'`
        );
      } catch (err: unknown) {
        const e = err as { code?: string };
        if (e?.code === '42501') {
          throw new Error(
            'Migración CircuitParentConfirmDeadline: ejecute como superusuario:\n' +
              "  ALTER TYPE circuit_status ADD VALUE IF NOT EXISTS 'CERRADO_SIN_CONFIRMACION_PADRE';\n" +
              'Luego: npm run migration:run'
          );
        }
        throw err;
      }
    }

    await queryRunner.query(`
      ALTER TABLE circuit_requests
      ADD COLUMN IF NOT EXISTS parent_confirm_deadline_at TIMESTAMPTZ NULL,
      ADD COLUMN IF NOT EXISTS parent_receipt_confirmed_at TIMESTAMPTZ NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE circuit_requests
      DROP COLUMN IF EXISTS parent_confirm_deadline_at,
      DROP COLUMN IF EXISTS parent_receipt_confirmed_at
    `);
  }
}
