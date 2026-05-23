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

import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UserRole } from '../../database/entities/user.entity';
import { ExternalVisitAudienceScope } from '../../database/entities/external-visit.entity';

/**
 * Resuelve listas de `userId` destino para eventos (visitas externas y reuniones)
 * a partir del alcance declarado por el organizador.
 *
 * Reusa patrones SQL ya probados en `NoticesService` (padres de grupo) y
 * `AcademicNotificationsService` (estudiantes + padres de grupo).
 */
@Injectable()
export class AudienceResolverService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource
  ) {}

  async resolveForVisit(input: {
    scope: ExternalVisitAudienceScope;
    schoolId: string;
    groupIds?: string[];
    studentIds?: string[];
  }): Promise<string[]> {
    const { scope, schoolId, groupIds = [], studentIds = [] } = input;
    if (scope === ExternalVisitAudienceScope.SCHOOL) {
      return this.usersOfSchool(schoolId);
    }
    if (scope === ExternalVisitAudienceScope.GROUPS) {
      if (groupIds.length === 0) return [];
      return this.studentsAndParentsByGroups(groupIds);
    }
    if (scope === ExternalVisitAudienceScope.STUDENTS) {
      if (studentIds.length === 0) return [];
      return this.studentsAndParentsByStudents(studentIds);
    }
    return [];
  }

  async resolveForMeeting(input: {
    schoolId: string;
    explicitUserIds?: string[];
    presetAllTeachersOfSchool?: boolean;
    presetAllAdministrativesOfSchool?: boolean;
    presetAllParentsOfGroupIds?: string[];
  }): Promise<string[]> {
    const set = new Set<string>();
    const {
      schoolId,
      explicitUserIds = [],
      presetAllTeachersOfSchool = false,
      presetAllAdministrativesOfSchool = false,
      presetAllParentsOfGroupIds = []
    } = input;

    for (const id of explicitUserIds) set.add(id);

    if (presetAllTeachersOfSchool) {
      for (const id of await this.usersByRoleOfSchool(schoolId, UserRole.DOCENTE)) set.add(id);
    }
    if (presetAllAdministrativesOfSchool) {
      for (const id of await this.usersByRoleOfSchool(schoolId, UserRole.ADMINISTRATIVO)) {
        set.add(id);
      }
    }
    if (presetAllParentsOfGroupIds.length > 0) {
      for (const id of await this.parentsOfGroups(presetAllParentsOfGroupIds)) set.add(id);
    }
    return [...set];
  }

  private async usersOfSchool(schoolId: string): Promise<string[]> {
    const rows = await this.dataSource.query<{ user_id: string }[]>(
      `SELECT id AS user_id FROM users WHERE school_id = $1 AND status = TRUE`,
      [schoolId]
    );
    return rows.map((r) => r.user_id);
  }

  private async usersByRoleOfSchool(schoolId: string, role: UserRole): Promise<string[]> {
    const rows = await this.dataSource.query<{ user_id: string }[]>(
      `SELECT id AS user_id FROM users WHERE school_id = $1 AND role = $2 AND status = TRUE`,
      [schoolId, role]
    );
    return rows.map((r) => r.user_id);
  }

  private async studentsAndParentsByGroups(groupIds: string[]): Promise<string[]> {
    const rows = await this.dataSource.query<{ user_id: string }[]>(
      `SELECT DISTINCT u.id AS user_id
       FROM students st
       INNER JOIN users u ON u.id = st.user_id
       WHERE st.group_id = ANY($1::uuid[])
       UNION
       SELECT DISTINCT u.id AS user_id
       FROM students st
       INNER JOIN student_parents sp ON sp.student_id = st.id
       INNER JOIN parents p ON p.id = sp.parent_id
       INNER JOIN users u ON u.id = p.user_id
       WHERE st.group_id = ANY($1::uuid[])`,
      [groupIds]
    );
    return rows.map((r) => r.user_id);
  }

  private async studentsAndParentsByStudents(studentIds: string[]): Promise<string[]> {
    const rows = await this.dataSource.query<{ user_id: string }[]>(
      `SELECT DISTINCT u.id AS user_id
       FROM students st
       INNER JOIN users u ON u.id = st.user_id
       WHERE st.id = ANY($1::uuid[])
       UNION
       SELECT DISTINCT u.id AS user_id
       FROM student_parents sp
       INNER JOIN parents p ON p.id = sp.parent_id
       INNER JOIN users u ON u.id = p.user_id
       WHERE sp.student_id = ANY($1::uuid[])`,
      [studentIds]
    );
    return rows.map((r) => r.user_id);
  }

  private async parentsOfGroups(groupIds: string[]): Promise<string[]> {
    const rows = await this.dataSource.query<{ user_id: string }[]>(
      `SELECT DISTINCT u.id AS user_id
       FROM student_parents sp
       INNER JOIN students st ON st.id = sp.student_id
       INNER JOIN parents p ON p.id = sp.parent_id
       INNER JOIN users u ON u.id = p.user_id
       WHERE st.group_id = ANY($1::uuid[])`,
      [groupIds]
    );
    return rows.map((r) => r.user_id);
  }
}
