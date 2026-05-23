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

export class VisitsMeetingsSchedules1775221171718 implements MigrationInterface {
  name = 'VisitsMeetingsSchedules1775221171718';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE visit_request_status AS ENUM (
          'PENDIENTE', 'APROBADA', 'RECHAZADA', 'REALIZADA', 'CANCELADA'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE meeting_status AS ENUM (
          'PENDIENTE', 'CONFIRMADA', 'REALIZADA', 'CANCELADA'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS visit_requests (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
        student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        visit_datetime TIMESTAMPTZ NOT NULL,
        reason TEXT,
        status visit_request_status NOT NULL DEFAULT 'PENDIENTE',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS parent_teacher_meetings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
        teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        meeting_datetime TIMESTAMPTZ NOT NULL,
        duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes > 0 AND duration_minutes <= 480),
        topic VARCHAR(255),
        notes TEXT,
        status meeting_status NOT NULL DEFAULT 'PENDIENTE',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS class_schedule_slots (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        weekday SMALLINT NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
        teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
        room VARCHAR(50),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (end_time > start_time)
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_visit_requests_parent ON visit_requests(parent_id);`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_visit_requests_student ON visit_requests(student_id);`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_meetings_parent ON parent_teacher_meetings(parent_id);`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_meetings_teacher ON parent_teacher_meetings(teacher_id);`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_schedule_slots_group ON class_schedule_slots(group_id);`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS class_schedule_slots;`);
    await queryRunner.query(`DROP TABLE IF EXISTS parent_teacher_meetings;`);
    await queryRunner.query(`DROP TABLE IF EXISTS visit_requests;`);
    await queryRunner.query(`DROP TYPE IF EXISTS meeting_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS visit_request_status;`);
  }
}
