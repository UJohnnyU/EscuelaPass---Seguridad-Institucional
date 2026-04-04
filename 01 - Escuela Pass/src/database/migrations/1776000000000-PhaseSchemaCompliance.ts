import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Si parte del esquema se aplicó manualmente con otro usuario, `CREATE TABLE IF NOT EXISTS`
 * no cambia el dueño: los `CREATE INDEX` fallarían con 42501. Esos índices se intentan dentro
 * de un bloque que ignora solo ese error (el índice puede existir ya o crearse luego como dueño).
 */
export class PhaseSchemaCompliance1776000000000 implements MigrationInterface {
  name = 'PhaseSchemaCompliance1776000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
        plate VARCHAR(20) NOT NULL,
        description VARCHAR(255),
        brand VARCHAR(100),
        model VARCHAR(100),
        color VARCHAR(50),
        year INTEGER CHECK (year IS NULL OR (year BETWEEN 1970 AND 2100)),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (parent_id, plate)
      );
    `);

    await queryRunner.query(`
      ALTER TABLE circuit_requests
      ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE circuit_requests
      ADD COLUMN IF NOT EXISTS teacher_signal VARCHAR(40) NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(120) NOT NULL,
        entity_type VARCHAR(80),
        entity_id UUID,
        metadata JSONB,
        ip_address INET,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      DO $idx_audit$
      BEGIN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)';
      EXCEPTION
        WHEN OTHERS THEN
          IF SQLSTATE = '42501' THEN NULL;
          ELSE RAISE;
          END IF;
      END;
      $idx_audit$;
    `);
    await queryRunner.query(`
      DO $idx_audit2$
      BEGIN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC)';
      EXCEPTION
        WHEN OTHERS THEN
          IF SQLSTATE = '42501' THEN NULL;
          ELSE RAISE;
          END IF;
      END;
      $idx_audit2$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS privacy_policies (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        version VARCHAR(32) NOT NULL UNIQUE,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        effective_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_privacy_acceptances (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        policy_version VARCHAR(32) NOT NULL,
        accepted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ip_address INET,
        PRIMARY KEY (user_id, policy_version)
      );
    `);

    await queryRunner.query(`
      INSERT INTO privacy_policies (version, title, content, effective_at)
      SELECT '1.0',
        'Política de tratamiento de datos personales (Escuela Pass)',
        'Versión inicial. El titular autoriza el tratamiento de datos personales conforme a la normativa aplicable. Consulte a la institución para el texto completo y actualizaciones.',
        CURRENT_TIMESTAMP
      WHERE NOT EXISTS (SELECT 1 FROM privacy_policies WHERE version = '1.0');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_privacy_acceptances;`);
    await queryRunner.query(`DROP TABLE IF EXISTS privacy_policies;`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs;`);
    await queryRunner.query(`ALTER TABLE circuit_requests DROP COLUMN IF EXISTS teacher_signal;`);
    await queryRunner.query(`ALTER TABLE circuit_requests DROP COLUMN IF EXISTS vehicle_id;`);
    await queryRunner.query(`DROP TABLE IF EXISTS vehicles;`);
  }
}
