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
