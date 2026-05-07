import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Elimina tablas y tipos que exceden el alcance del FTG (RF1–RF8):
 * external_visits (visitas institucionales), meetings (reuniones padre-docente),
 * student_attention_notes (anotaciones de atención), admin_reports (tickets SLA),
 * y pickup_authorizations (sin uso real; circuito usa student_parents.can_pickup).
 */
export class RemoveOutOfScopeTables1778700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS admin_report_comments CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS admin_reports CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS student_attention_notes CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS meeting_participants CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS meetings CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS meeting_status CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS external_visit_students CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS external_visit_groups CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS external_visits CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS pickup_authorizations CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreación no incluida: estas tablas se eliminan intencionalmente por estar fuera del FTG.
    // Para restaurarlas, aplica el esquema v4 completo o las migraciones previas correspondientes.
  }
}
