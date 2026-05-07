import * as path from 'path';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { readSqlFileUtf8NoBom } from '../read-sql-file-utf8';

/**
 * Primera migración en bases nuevas: aplica el DDL histórico congelado en
 * `src/database/baseline/typeorm-baseline-v3.sql` (no confundir con el esquema
 * de referencia `escuela_pass_schema_v4.sql` usado por `npm run db:apply`).
 */
export class BaselineSchema1712050000000 implements MigrationInterface {
  name = 'BaselineSchema1712050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaPath = path.resolve(__dirname, '..', 'baseline', 'typeorm-baseline-v3.sql');
    const schemaSql = readSqlFileUtf8NoBom(schemaPath);
    await queryRunner.query(schemaSql);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Baseline intencionalmente no hace rollback destructivo.
  }
}

