import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Homologa debts.status entre entornos:
 * - Si es enum: asegura COMPROBANTE_RECHAZADO.
 * - Si es varchar/text: asegura CHECK con los 4 valores válidos.
 */
export class NormalizeDebtStatusAcrossEnvironments1777400000000 implements MigrationInterface {
  name = 'NormalizeDebtStatusAcrossEnvironments1777400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        has_debts boolean;
        status_udt text;
        con_row record;
      BEGIN
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables t
          WHERE t.table_schema = current_schema()
            AND t.table_name = 'debts'
        ) INTO has_debts;

        IF NOT has_debts THEN
          RETURN;
        END IF;

        SELECT c.udt_name
          INTO status_udt
        FROM information_schema.columns c
        WHERE c.table_schema = current_schema()
          AND c.table_name = 'debts'
          AND c.column_name = 'status'
        LIMIT 1;

        IF status_udt IS NULL THEN
          RETURN;
        END IF;

        IF EXISTS (
          SELECT 1
          FROM pg_type t
          WHERE t.typname = status_udt
            AND t.typtype = 'e'
        ) THEN
          BEGIN
            EXECUTE format(
              'ALTER TYPE %I ADD VALUE %L',
              status_udt,
              'COMPROBANTE_RECHAZADO'
            );
          EXCEPTION
            WHEN duplicate_object THEN NULL;
          END;
        ELSE
          FOR con_row IN
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace ns ON ns.oid = rel.relnamespace
            JOIN pg_attribute att ON att.attrelid = rel.oid
            WHERE con.contype = 'c'
              AND ns.nspname = current_schema()
              AND rel.relname = 'debts'
              AND att.attname = 'status'
              AND att.attnum = ANY (con.conkey)
          LOOP
            EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'debts', con_row.conname);
          END LOOP;

          BEGIN
            EXECUTE $sql$
              ALTER TABLE debts
              ADD CONSTRAINT ck_debts_status
              CHECK (status IN ('PENDIENTE', 'PAGADO', 'VENCIDO', 'COMPROBANTE_RECHAZADO'))
              NOT VALID
            $sql$;
          EXCEPTION
            WHEN duplicate_object THEN NULL;
          END;
        END IF;

        BEGIN
          EXECUTE $sql$
            ALTER TABLE debts
            ALTER COLUMN status
            SET DEFAULT 'PENDIENTE'
          $sql$;
        EXCEPTION
          WHEN others THEN NULL;
        END;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.tables t
          WHERE t.table_schema = current_schema()
            AND t.table_name = 'debts'
        ) THEN
          BEGIN
            ALTER TABLE debts DROP CONSTRAINT IF EXISTS ck_debts_status;
          EXCEPTION
            WHEN others THEN NULL;
          END;
        END IF;
      END $$;
    `);
  }
}
