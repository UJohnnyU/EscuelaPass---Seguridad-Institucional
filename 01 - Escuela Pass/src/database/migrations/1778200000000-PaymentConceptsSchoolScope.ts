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
