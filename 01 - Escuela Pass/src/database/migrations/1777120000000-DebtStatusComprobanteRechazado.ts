import { MigrationInterface, QueryRunner } from 'typeorm';

/** Permite marcar obligaciones cuyo comprobante fue rechazado por administración (previo a nuevo intento del padre). */
export class DebtStatusComprobanteRechazado1777120000000 implements MigrationInterface {
  name = 'DebtStatusComprobanteRechazado1777120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE enum_type_name text;
      BEGIN
        /* Detecta el tipo real de debts.status; en algunos entornos es enum y en otros varchar/text. */
        SELECT c.udt_name
          INTO enum_type_name
        FROM information_schema.columns c
        JOIN pg_type t ON t.typname = c.udt_name
        WHERE c.table_schema = current_schema()
          AND c.table_name = 'debts'
          AND c.column_name = 'status'
          AND t.typtype = 'e'
        LIMIT 1;

        IF enum_type_name IS NULL THEN
          /* Si no es enum nativo, no hay nada que alterar en esta migración. */
          RETURN;
        END IF;

        BEGIN
          EXECUTE format(
            'ALTER TYPE %I ADD VALUE %L',
            enum_type_name,
            'COMPROBANTE_RECHAZADO'
          );
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END;
      END $$;
    `);
  }

  public async down(): Promise<void> {
    /* Los valores de enum en PostgreSQL no se eliminan de forma portable aquí. */
  }
}
