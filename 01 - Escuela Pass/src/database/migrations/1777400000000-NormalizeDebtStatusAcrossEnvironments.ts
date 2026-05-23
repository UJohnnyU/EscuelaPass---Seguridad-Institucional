/*
Escuela Pass — Proprietary Software License
Copyright (c) 2026 Murillo Martínez Jhon Kevin. All Rights Reserved.

NOTICE: This software and associated documentation files (the "Software")
constitute proprietary intellectual property. Unauthorized use is prohibited.

1. GRANT OF RIGHTS
   No license is granted to any person or entity except as expressly set
   forth in a separate written agreement signed by the copyright holder.

2. RESTRICTIONS
   Without prior written permission from the copyright holder, you may NOT:
   (a) copy, modify, adapt, translate, or create derivative works of the Software;
   (b) reverse engineer, decompile, or disassemble the Software, except as
       permitted by applicable law;
   (c) distribute, sublicense, lease, rent, sell, or otherwise transfer the
       Software or any portion thereof;
   (d) use the Software for commercial purposes, including offering it as a
       hosted service to third parties;
   (e) remove or alter any proprietary notices, labels, or marks.

3. THIRD-PARTY COMPONENTS
   The Software may include or depend on third-party open-source components
   licensed under their own terms (see package manifests and NOTICE files).
   Those components remain governed by their respective licenses. This license
   applies only to the original work of the copyright holder.

4. ACADEMIC REPOSITORY (POLI JIC)
   A non-exclusive, royalty-free, limited license is granted to Politécnico
   Colombiano Jaime Isaza Cadavid solely to archive, reproduce, and make
   available the version of the Software submitted as part of the author's
   degree thesis for academic, educational, and non-commercial public
   consultation purposes, in accordance with institutional publication
   authorization. This does not grant commercial exploitation rights to
   the institution or to third parties.

5. NO WARRANTY
   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL
   THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY.

6. GOVERNING LAW
   This license shall be governed by the laws of the Republic of Colombia,
   without regard to conflict-of-law principles.

7. CONTACT
   For licensing inquiries: jhonkevinmurillom@gmail.com

---

Resumen en español:
Software propietario de Murillo Martínez Jhon Kevin (2026). Queda prohibida la
copia, modificación, distribución o explotación comercial sin autorización
escrita. El POLI JIC cuenta con autorización limitada, no exclusiva y sin
fines de lucro, para archivo y consulta académica de la versión entregada
como Trabajo de Grado. Los componentes de terceros se rigen por sus propias
licencias.
*/

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
