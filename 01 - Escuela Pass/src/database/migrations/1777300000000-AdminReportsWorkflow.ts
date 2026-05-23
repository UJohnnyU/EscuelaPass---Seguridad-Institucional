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

export class AdminReportsWorkflow1777300000000 implements MigrationInterface {
  name = 'AdminReportsWorkflow1777300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS admin_reports (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        assigned_admin_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
        type varchar(16) NOT NULL DEFAULT 'OTRO',
        subject varchar(160) NOT NULL,
        message text NOT NULL,
        status varchar(16) NOT NULL DEFAULT 'PENDIENTE',
        resolved_by_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
        resolved_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_admin_reports_type CHECK (type IN ('ERROR','SUGERENCIA','PETICION','OTRO')),
        CONSTRAINT ck_admin_reports_status CHECK (status IN ('PENDIENTE','EN_PROCESO','RESUELTO'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_admin_reports_school_status ON admin_reports (school_id, status)`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_admin_reports_created_by ON admin_reports (created_by_user_id)`
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS admin_report_comments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id uuid NOT NULL REFERENCES admin_reports(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        message text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ix_admin_report_comments_report ON admin_report_comments (report_id, created_at)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS ix_admin_report_comments_report`);
    await queryRunner.query(`DROP TABLE IF EXISTS admin_report_comments`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_admin_reports_created_by`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_admin_reports_school_status`);
    await queryRunner.query(`DROP TABLE IF EXISTS admin_reports`);
  }
}
