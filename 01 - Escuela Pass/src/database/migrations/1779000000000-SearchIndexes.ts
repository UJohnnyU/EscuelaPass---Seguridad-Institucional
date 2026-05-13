import { MigrationInterface, QueryRunner } from 'typeorm';

export class SearchIndexes1779000000000 implements MigrationInterface {
  name = 'SearchIndexes1779000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_students_matricula_trgm
      ON students USING gin (matricula gin_trgm_ops)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_users_full_name_trgm
      ON users USING gin (full_name gin_trgm_ops)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_circuit_requests_student_time
      ON circuit_requests (student_id, request_time DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_circuit_requests_student_time`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_full_name_trgm`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_students_matricula_trgm`);
  }
}
