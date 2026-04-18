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
