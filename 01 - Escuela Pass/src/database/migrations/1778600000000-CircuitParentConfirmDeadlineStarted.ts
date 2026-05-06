import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Inicio explícito del plazo para confirmación del padre en EN_CAMINO + ALUMNO_CAMINO_A_SALIDA.
 * Permite cierre automático solo cuando existía una ventana coherente (evita filas solo con deadline legacy).
 */
export class CircuitParentConfirmDeadlineStarted1778600000000 implements MigrationInterface {
  name = 'CircuitParentConfirmDeadlineStarted1778600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE circuit_requests
      ADD COLUMN IF NOT EXISTS parent_confirm_deadline_started_at TIMESTAMPTZ NULL
    `);

    await queryRunner.query(`
      UPDATE circuit_requests
      SET parent_confirm_deadline_started_at = parent_confirm_deadline_at - INTERVAL '15 minutes'
      WHERE parent_confirm_deadline_at IS NOT NULL
        AND parent_confirm_deadline_started_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE circuit_requests
      DROP COLUMN IF EXISTS parent_confirm_deadline_started_at
    `);
  }
}
