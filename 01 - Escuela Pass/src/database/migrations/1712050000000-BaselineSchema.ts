import { MigrationInterface, QueryRunner } from 'typeorm';

export class BaselineSchema1712050000000 implements MigrationInterface {
  name = 'BaselineSchema1712050000000';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // Baseline no-op:
    // El esquema actual se gestiona con `escuela_pass_schema_v3.sql`.
    // Desde esta migración en adelante, los cambios de BD deben entrar por TypeORM migrations.
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No-op intencional.
  }
}

