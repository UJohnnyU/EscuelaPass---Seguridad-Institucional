import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índices de rendimiento (RNF4: tiempo de respuesta ≤ 2 s bajo carga media).
 *
 * - circuit_requests: búsqueda por fecha y escuela en Circuito del día.
 * - attendance_records: consultas por grupo y fecha en informes de asistencia.
 * - notifications: notificaciones no leídas del usuario (badge + listado).
 * - access_credentials: búsqueda por tipo + valor al escanear QR/NFC.
 */
export class PerformanceIndexes1778800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Circuito del día: filtrar por fecha de solicitud y escuela del estudiante
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_circuit_requests_date
        ON circuit_requests (request_time DESC)
    `);

    // Asistencia: informes por grupo y fecha
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_attendance_records_group_date
        ON attendance_records (group_id, attendance_date DESC)
    `);

    // Notificaciones no leídas (badge de campana + GET /notifications/me)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
        ON notifications (user_id, sent_at DESC)
        WHERE read_at IS NULL
    `);

    // Credenciales de acceso: lookup por tipo + valor al escanear
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_access_credentials_type_value
        ON access_credentials (credential_type, credential_value)
        WHERE status = 'ACTIVE'
    `);

    // Eventos de acceso: historial por usuario y fecha
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_access_events_user_date
        ON access_events (user_id, event_date DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_access_events_user_date`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_access_credentials_type_value`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_notifications_user_unread`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_attendance_records_group_date`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_circuit_requests_date`);
  }
}
