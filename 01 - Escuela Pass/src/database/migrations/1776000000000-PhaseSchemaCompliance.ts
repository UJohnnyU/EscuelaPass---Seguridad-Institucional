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
