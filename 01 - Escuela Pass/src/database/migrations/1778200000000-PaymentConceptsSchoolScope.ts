import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega school_id a payment_concepts para soporte multi-tenant.
 * - Los conceptos existentes con school_id = NULL se tratan como globales/base (is_base = true).
 * - La restricción UNIQUE(name) global se reemplaza por UNIQUE(school_id, lower(name)) por escuela
 *   y UNIQUE(lower(name)) para conceptos globales (school_id IS NULL).
 */
export class PaymentConceptsSchoolScope1778200000000 implements MigrationInterface {
  name = 'PaymentConceptsSchoolScope1778200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE payment_concepts ADD COLUMN IF NOT EXISTS school_id uuid NULL`);
    await queryRunner.query(`
      DO $$
      BEGIN
        BEGIN
          ALTER TABLE payment_concepts
            ADD CONSTRAINT fk_payment_concepts_school_id
            FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END;
      END $$;
    `);

    /* Intentar asignar los conceptos ya existentes (no base) a la única escuela si existe solo una. */
    await queryRunner.query(`
      DO $$
      DECLARE
        sole_school_id uuid;
        school_count integer;
      BEGIN
        SELECT count(*) INTO school_count FROM schools WHERE status = true;
        IF school_count = 1 THEN
          SELECT id INTO sole_school_id FROM schools WHERE status = true LIMIT 1;
          UPDATE payment_concepts
          SET school_id = sole_school_id
          WHERE school_id IS NULL AND is_base = false;
        END IF;
      END $$;
    `);

    /* Eliminar el UNIQUE global en name si existe. */
    await queryRunner.query(`
      DO $$
      DECLARE con_name text;
      BEGIN
        SELECT c.conname INTO con_name
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = current_schema()
          AND t.relname = 'payment_concepts'
          AND c.contype = 'u'
          AND array_length(c.conkey, 1) = 1
          AND (
            SELECT a.attname FROM pg_attribute a
            WHERE a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
          ) = 'name'
        LIMIT 1;
        IF con_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE payment_concepts DROP CONSTRAINT %I', con_name);
        END IF;
      END $$;
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS payment_concepts_name_key`);

    /* Índice único por escuela + nombre (normalizado). */
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_concepts_school_name
      ON payment_concepts (school_id, lower(name))
      WHERE school_id IS NOT NULL
    `);

    /* Índice único para conceptos globales (is_base sin escuela). */
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_concepts_global_name
      ON payment_concepts (lower(name))
      WHERE school_id IS NULL
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_payment_concepts_school ON payment_concepts (school_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS ix_payment_concepts_school`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_payment_concepts_global_name`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_payment_concepts_school_name`);
    await queryRunner.query(`ALTER TABLE payment_concepts DROP CONSTRAINT IF EXISTS fk_payment_concepts_school_id`);
    await queryRunner.query(`ALTER TABLE payment_concepts DROP COLUMN IF EXISTS school_id`);
    await queryRunner.query(`ALTER TABLE payment_concepts ADD CONSTRAINT payment_concepts_name_key UNIQUE (name)`);
  }
}
