import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserPasswordResetTokens1778300000000 implements MigrationInterface {
  name = 'UserPasswordResetTokens1778300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token varchar(128) NULL`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires_at timestamptz NULL`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_users_password_reset_token ON users (password_reset_token) WHERE password_reset_token IS NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS ix_users_password_reset_token`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS password_reset_expires_at`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS password_reset_token`);
  }
}
