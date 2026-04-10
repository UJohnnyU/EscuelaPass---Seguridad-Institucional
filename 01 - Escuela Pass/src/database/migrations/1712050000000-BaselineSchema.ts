import * as fs from 'fs';
import * as path from 'path';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class BaselineSchema1712050000000 implements MigrationInterface {
  name = 'BaselineSchema1712050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaPath = path.resolve(__dirname, '..', '..', '..', 'escuela_pass_schema_v3.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await queryRunner.query(schemaSql);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Baseline intencionalmente no hace rollback destructivo.
  }
}

