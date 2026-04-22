import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminReportsWorkflow1777300000000 implements MigrationInterface {
  name = 'AdminReportsWorkflow1777300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS admin_reports (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        assigned_admin_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
        type varchar(16) NOT NULL DEFAULT 'OTRO',
        subject varchar(160) NOT NULL,
        message text NOT NULL,
        status varchar(16) NOT NULL DEFAULT 'PENDIENTE',
        resolved_by_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
        resolved_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_admin_reports_type CHECK (type IN ('ERROR','SUGERENCIA','PETICION','OTRO')),
        CONSTRAINT ck_admin_reports_status CHECK (status IN ('PENDIENTE','EN_PROCESO','RESUELTO'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_admin_reports_school_status ON admin_reports (school_id, status)`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_admin_reports_created_by ON admin_reports (created_by_user_id)`
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS admin_report_comments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id uuid NOT NULL REFERENCES admin_reports(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        message text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_admin_report_comments_report ON admin_report_comments (report_id, created_at)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS ix_admin_report_comments_report`);
    await queryRunner.query(`DROP TABLE IF EXISTS admin_report_comments`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_admin_reports_created_by`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_admin_reports_school_status`);
    await queryRunner.query(`DROP TABLE IF EXISTS admin_reports`);
  }
}
