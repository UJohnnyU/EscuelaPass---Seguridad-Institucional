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
 * Añade PADRE_EN_CAMINO al enum circuit_status.
 * Requiere ser **dueño** del tipo o superusuario. Si el tipo lo creó `postgres` y migras con otro usuario,
 * ejecuta una vez como superusuario:
 *   ALTER TYPE circuit_status ADD VALUE IF NOT EXISTS 'PADRE_EN_CAMINO';
 * Luego vuelve a ejecutar `npm run migration:run` (la migración detectará el valor y no hará nada).
 */
export class CircuitPadreEnCamino1776100000000 implements MigrationInterface {
  name = 'CircuitPadreEnCamino1776100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'circuit_status' AND e.enumlabel = 'PADRE_EN_CAMINO'
      ) AS ok
    `);
    if (exists[0]?.ok === true) {
      return;
    }

    try {
      await queryRunner.query(`ALTER TYPE circuit_status ADD VALUE 'PADRE_EN_CAMINO'`);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e?.code === '42501') {
        throw new Error(
          'Migración CircuitPadreEnCamino: el usuario de BD no es dueño del tipo circuit_status. ' +
            'Conéctese como postgres (o el dueño del tipo) y ejecute:\n' +
            "  ALTER TYPE circuit_status ADD VALUE IF NOT EXISTS 'PADRE_EN_CAMINO';\n" +
            'Opcionalmente: ALTER TYPE circuit_status OWNER TO <usuario_app>;\n' +
            'Después ejecute de nuevo: npm run migration:run'
        );
      }
      throw err;
    }
  }

  public async down(): Promise<void> {
    // Quitar un valor de ENUM en PostgreSQL requiere recrear el tipo; no se revierte aquí.
  }
}
