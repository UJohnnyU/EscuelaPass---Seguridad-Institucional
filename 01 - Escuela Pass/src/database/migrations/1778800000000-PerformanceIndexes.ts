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
 * Índices de rendimiento (RNF4: tiempo de respuesta ≤ 2 s bajo carga media).
 *
 * - circuit_requests: búsqueda por fecha y escuela en Circuito del día.
 * - attendance_records: consultas por grupo y fecha en informes de asistencia.
 * - notifications: notificaciones no leídas del usuario (badge + listado).
 * - access_credentials: búsqueda por tipo + valor al escanear QR/NFC.
 */
export class PerformanceIndexes1778800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Circuito del día: filtrar por fecha de solicitud y escuela del estudiante
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_circuit_requests_date
        ON circuit_requests (request_time DESC)
    `);

    // Asistencia: informes por grupo y fecha
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_attendance_records_group_date
        ON attendance_records (group_id, attendance_date DESC)
    `);

    // Notificaciones no leídas (badge de campana + GET /notifications/me)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
        ON notifications (user_id, sent_at DESC)
        WHERE read_at IS NULL
    `);

    // Credenciales de acceso: lookup por tipo + valor al escanear
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_access_credentials_type_value
        ON access_credentials (credential_type, credential_value)
        WHERE status = 'ACTIVE'
    `);

    // Eventos de acceso: historial por usuario y fecha
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_access_events_user_date
        ON access_events (user_id, event_date DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_access_events_user_date`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_access_credentials_type_value`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_notifications_user_unread`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_attendance_records_group_date`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_circuit_requests_date`);
  }
}
