import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserFcmTokens1775500000000 implements MigrationInterface {
  name = 'UserFcmTokens1775500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_fcm_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        platform VARCHAR(32),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (token)
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_user ON user_fcm_tokens(user_id);`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_fcm_tokens;`);
  }
}
