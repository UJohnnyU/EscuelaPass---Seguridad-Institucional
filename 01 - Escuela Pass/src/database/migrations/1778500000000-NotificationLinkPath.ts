import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationLinkPath1778500000000 implements MigrationInterface {
  name = 'NotificationLinkPath1778500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link_path VARCHAR(480) NULL`
    );
    /** Plazos de confirmación creados antes de requerir la 2.ª señal docente: limpiar para no cerrar en falso. */
    await queryRunner.query(`
      UPDATE circuit_requests
      SET parent_confirm_deadline_at = NULL
      WHERE status = 'EN_CAMINO'::circuit_status
        AND (teacher_signal IS NULL OR teacher_signal <> 'ALUMNO_CAMINO_A_SALIDA')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE notifications DROP COLUMN IF EXISTS link_path`);
  }
}
