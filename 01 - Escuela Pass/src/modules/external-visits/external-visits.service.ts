import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  ExternalVisitAudienceScope,
  ExternalVisitEntity,
  ExternalVisitStatus
} from '../../database/entities/external-visit.entity';
import { ExternalVisitGroupEntity } from '../../database/entities/external-visit-group.entity';
import { ExternalVisitStudentEntity } from '../../database/entities/external-visit-student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { AudienceResolverService } from '../events-core/audience-resolver.service';
import { EventNotificationsService } from '../events-core/event-notifications.service';
import { CreateExternalVisitDto } from './dto/create-external-visit.dto';
import { RescheduleExternalVisitDto } from './dto/reschedule-external-visit.dto';
import { UpdateExternalVisitDto } from './dto/update-external-visit.dto';

type VisitRow = ExternalVisitEntity & {
  groupIds: string[];
  studentIds: string[];
};

@Injectable()
export class ExternalVisitsService {
  private readonly logger = new Logger(ExternalVisitsService.name);

  constructor(
    @InjectRepository(ExternalVisitEntity)
    private readonly visitsRepository: Repository<ExternalVisitEntity>,
    @InjectRepository(ExternalVisitGroupEntity)
    private readonly visitGroupsRepository: Repository<ExternalVisitGroupEntity>,
    @InjectRepository(ExternalVisitStudentEntity)
    private readonly visitStudentsRepository: Repository<ExternalVisitStudentEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachersRepository: Repository<TeacherEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly audienceResolver: AudienceResolverService,
    private readonly notifier: EventNotificationsService
  ) {}

  async create(dto: CreateExternalVisitDto, userId: string, role: UserRole, schoolIdParam?: string): Promise<VisitRow> {
    const schoolId = await this.assertStaffSchool(userId, role, schoolIdParam);

    const groupIds = dto.audienceScope === ExternalVisitAudienceScope.GROUPS ? dto.groupIds ?? [] : [];
    const studentIds =
      dto.audienceScope === ExternalVisitAudienceScope.STUDENTS ? dto.studentIds ?? [] : [];

    await this.assertScopeBelongsToSchool(schoolId, groupIds, studentIds);
    if (role === UserRole.DOCENTE) {
      await this.assertTeacherOwnsScope(userId, groupIds, studentIds, dto.audienceScope);
    }

    const saved = await this.dataSource.transaction(async (em) => {
      const row = em.create(ExternalVisitEntity, {
        schoolId,
        createdByUserId: userId,
        creatorRole: role,
        title: dto.title.trim(),
        purpose: dto.purpose.trim(),
        visitorName: dto.visitorName.trim(),
        visitorOrganization: dto.visitorOrganization?.trim() ?? null,
        location: dto.location?.trim() ?? null,
        visitDatetime: new Date(dto.visitDatetime),
        durationMinutes: dto.durationMinutes ?? 60,
        audienceScope: dto.audienceScope,
        status: ExternalVisitStatus.PROGRAMADA
      });
      const persisted = await em.save(row);

      if (groupIds.length > 0) {
        await em.save(
          ExternalVisitGroupEntity,
          groupIds.map((groupId) => ({ visitId: persisted.id, groupId }))
        );
      }
      if (studentIds.length > 0) {
        await em.save(
          ExternalVisitStudentEntity,
          studentIds.map((studentId) => ({ visitId: persisted.id, studentId }))
        );
      }
      return persisted;
    });

    await this.notifyAudience(saved, groupIds, studentIds, 'visit_created', {
      title: `Nueva visita: ${saved.title}`,
      body: this.buildNotificationBody(saved)
    });

    return this.getDetail(saved.id, userId, role);
  }

  async list(user: { userId: string; role: UserRole }, schoolIdParam?: string): Promise<VisitRow[]> {
    const qb = this.visitsRepository.createQueryBuilder('v').orderBy('v.visit_datetime', 'DESC');
    if (user.role === UserRole.ADMIN) {
      if (schoolIdParam?.trim()) {
        qb.where('v.school_id = :sid', { sid: schoolIdParam.trim() });
      }
      const all = await qb.getMany();
      return this.hydrate(all);
    }
    const userRow = await this.usersRepository.findOne({ where: { id: user.userId } });
    if (!userRow?.schoolId) {
      throw new ForbiddenException('Usuario sin institución asignada');
    }
    if (user.role === UserRole.ADMINISTRATIVO) {
      const rows = await qb.where('v.school_id = :s', { s: userRow.schoolId }).getMany();
      return this.hydrate(rows);
    }
    if (user.role === UserRole.DOCENTE) {
      const teacher = await this.teachersRepository.findOne({ where: { userId: user.userId } });
      if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');
      const rows = await qb
        .where('v.school_id = :s', { s: userRow.schoolId })
        .andWhere('v.created_by_user_id = :uid', { uid: user.userId })
        .getMany();
      return this.hydrate(rows);
    }
    throw new ForbiddenException('Rol sin acceso a listado staff de visitas');
  }

  async listMine(user: { userId: string; role: UserRole }): Promise<VisitRow[]> {
    const rows = await this.dataSource.query<Array<Record<string, unknown>>>(
      `
      SELECT v.* FROM external_visits v
      WHERE v.audience_scope = 'SCHOOL'
        AND EXISTS (
          SELECT 1 FROM users u WHERE u.id = $1 AND u.school_id = v.school_id
        )
      UNION
      SELECT v.* FROM external_visits v
      INNER JOIN external_visit_groups vg ON vg.visit_id = v.id
      WHERE v.audience_scope = 'GROUPS' AND (
        EXISTS (
          SELECT 1 FROM students st
          WHERE st.user_id = $1 AND st.group_id = vg.group_id
        ) OR EXISTS (
          SELECT 1
          FROM student_parents sp
          INNER JOIN parents p ON p.id = sp.parent_id
          INNER JOIN students st ON st.id = sp.student_id
          WHERE p.user_id = $1 AND st.group_id = vg.group_id
        ) OR EXISTS (
          SELECT 1 FROM teacher_groups tg
          INNER JOIN teachers t ON t.id = tg.teacher_id
          WHERE t.user_id = $1 AND tg.group_id = vg.group_id
        )
      )
      UNION
      SELECT v.* FROM external_visits v
      INNER JOIN external_visit_students vs ON vs.visit_id = v.id
      WHERE v.audience_scope = 'STUDENTS' AND (
        EXISTS (
          SELECT 1 FROM students st WHERE st.user_id = $1 AND st.id = vs.student_id
        ) OR EXISTS (
          SELECT 1
          FROM student_parents sp
          INNER JOIN parents p ON p.id = sp.parent_id
          WHERE p.user_id = $1 AND sp.student_id = vs.student_id
        )
      )
      ORDER BY visit_datetime DESC
      `,
      [user.userId]
    );
    return this.hydrate(this.normalizeRawRows(rows));
  }

  async getDetail(id: string, userId: string, role: UserRole): Promise<VisitRow> {
    const visit = await this.visitsRepository.findOne({ where: { id } });
    if (!visit) throw new NotFoundException('Visita no encontrada');
    await this.assertCanView(visit, userId, role);
    const [detail] = await this.hydrate([visit]);
    return detail;
  }

  async update(
    id: string,
    dto: UpdateExternalVisitDto,
    userId: string,
    role: UserRole
  ): Promise<VisitRow> {
    const visit = await this.assertCanModify(id, userId, role);
    if (
      visit.status === ExternalVisitStatus.REALIZADA ||
      visit.status === ExternalVisitStatus.CANCELADA
    ) {
      throw new BadRequestException('No se puede editar una visita finalizada o cancelada');
    }

    const nextScope = dto.audienceScope ?? visit.audienceScope;
    const groupIds = nextScope === ExternalVisitAudienceScope.GROUPS ? dto.groupIds ?? [] : [];
    const studentIds = nextScope === ExternalVisitAudienceScope.STUDENTS ? dto.studentIds ?? [] : [];
    await this.assertScopeBelongsToSchool(visit.schoolId, groupIds, studentIds);
    if (role === UserRole.DOCENTE) {
      await this.assertTeacherOwnsScope(userId, groupIds, studentIds, nextScope);
    }

    await this.dataSource.transaction(async (em) => {
      if (dto.title !== undefined) visit.title = dto.title.trim();
      if (dto.purpose !== undefined) visit.purpose = dto.purpose.trim();
      if (dto.visitorName !== undefined) visit.visitorName = dto.visitorName.trim();
      if (dto.visitorOrganization !== undefined)
        visit.visitorOrganization = dto.visitorOrganization.trim() || null;
      if (dto.location !== undefined) visit.location = dto.location.trim() || null;
      if (dto.durationMinutes !== undefined) visit.durationMinutes = dto.durationMinutes;
      if (dto.audienceScope !== undefined) visit.audienceScope = dto.audienceScope;
      await em.save(visit);

      if (dto.audienceScope !== undefined || dto.groupIds !== undefined || dto.studentIds !== undefined) {
        await em.delete(ExternalVisitGroupEntity, { visitId: visit.id });
        await em.delete(ExternalVisitStudentEntity, { visitId: visit.id });
        if (groupIds.length > 0) {
          await em.save(
            ExternalVisitGroupEntity,
            groupIds.map((groupId) => ({ visitId: visit.id, groupId }))
          );
        }
        if (studentIds.length > 0) {
          await em.save(
            ExternalVisitStudentEntity,
            studentIds.map((studentId) => ({ visitId: visit.id, studentId }))
          );
        }
      }
    });

    const updated = await this.visitsRepository.findOneOrFail({ where: { id: visit.id } });
    const currentGroupIds = await this.loadVisitGroupIds(updated.id);
    const currentStudentIds = await this.loadVisitStudentIds(updated.id);
    await this.notifyAudience(updated, currentGroupIds, currentStudentIds, 'visit_updated', {
      title: `Visita actualizada: ${updated.title}`,
      body: this.buildNotificationBody(updated)
    });
    return this.getDetail(updated.id, userId, role);
  }

  async reschedule(
    id: string,
    dto: RescheduleExternalVisitDto,
    userId: string,
    role: UserRole
  ): Promise<VisitRow> {
    const visit = await this.assertCanModify(id, userId, role);
    if (
      visit.status === ExternalVisitStatus.REALIZADA ||
      visit.status === ExternalVisitStatus.CANCELADA
    ) {
      throw new BadRequestException('No se puede reprogramar una visita finalizada o cancelada');
    }
    const newDate = new Date(dto.visitDatetime);
    visit.previousDatetime = visit.visitDatetime;
    visit.visitDatetime = newDate;
    if (dto.durationMinutes !== undefined) visit.durationMinutes = dto.durationMinutes;
    visit.status = ExternalVisitStatus.REPROGRAMADA;
    visit.reminded24hAt = null;
    visit.reminded1hAt = null;
    await this.visitsRepository.save(visit);

    const groupIds = await this.loadVisitGroupIds(visit.id);
    const studentIds = await this.loadVisitStudentIds(visit.id);
    await this.notifyAudience(visit, groupIds, studentIds, 'visit_rescheduled', {
      title: `Visita reprogramada: ${visit.title}`,
      body: this.buildNotificationBody(visit)
    });
    return this.getDetail(visit.id, userId, role);
  }

  async cancel(
    id: string,
    reason: string | undefined,
    userId: string,
    role: UserRole
  ): Promise<VisitRow> {
    const visit = await this.assertCanModify(id, userId, role);
    if (visit.status === ExternalVisitStatus.REALIZADA) {
      throw new BadRequestException('No se puede cancelar una visita ya realizada');
    }
    visit.status = ExternalVisitStatus.CANCELADA;
    visit.cancellationReason = reason?.trim() ?? null;
    await this.visitsRepository.save(visit);

    const groupIds = await this.loadVisitGroupIds(visit.id);
    const studentIds = await this.loadVisitStudentIds(visit.id);
    await this.notifyAudience(visit, groupIds, studentIds, 'visit_cancelled', {
      title: `Visita cancelada: ${visit.title}`,
      body: reason?.trim() ? `Motivo: ${reason.trim()}` : 'La visita ha sido cancelada.'
    });
    return this.getDetail(visit.id, userId, role);
  }

  async markRealized(id: string, userId: string, role: UserRole): Promise<VisitRow> {
    const visit = await this.assertCanModify(id, userId, role);
    if (visit.status === ExternalVisitStatus.CANCELADA) {
      throw new BadRequestException('La visita está cancelada');
    }
    visit.status = ExternalVisitStatus.REALIZADA;
    await this.visitsRepository.save(visit);
    return this.getDetail(visit.id, userId, role);
  }

  private buildNotificationBody(visit: ExternalVisitEntity): string {
    const whenIso = visit.visitDatetime instanceof Date
      ? visit.visitDatetime.toISOString()
      : new Date(visit.visitDatetime as unknown as string).toISOString();
    const parts = [
      `Fecha: ${whenIso}`,
      `Visitante: ${visit.visitorName}`
    ];
    if (visit.visitorOrganization) parts.push(`Organización: ${visit.visitorOrganization}`);
    if (visit.location) parts.push(`Lugar: ${visit.location}`);
    return parts.join(' · ');
  }

  private async notifyAudience(
    visit: ExternalVisitEntity,
    groupIds: string[],
    studentIds: string[],
    type:
      | 'visit_created'
      | 'visit_updated'
      | 'visit_rescheduled'
      | 'visit_cancelled'
      | 'visit_reminder',
    content: { title: string; body: string }
  ): Promise<void> {
    const userIds = await this.audienceResolver.resolveForVisit({
      scope: visit.audienceScope,
      schoolId: visit.schoolId,
      groupIds,
      studentIds
    });
    await this.notifier.notifyUsers(userIds, content.title, content.body, {
      type,
      visitId: visit.id
    });
  }

  private async assertStaffSchool(userId: string, role: UserRole, schoolIdParam?: string): Promise<string> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new ForbiddenException('Usuario no encontrado');
    if (role === UserRole.ADMIN) {
      const sid = schoolIdParam?.trim() || user.schoolId || '';
      if (!sid) throw new BadRequestException('Admin debe elegir una escuela');
      const schoolRows = await this.dataSource.query<{ id: string }[]>(
        `SELECT id FROM schools WHERE id = $1 LIMIT 1`,
        [sid]
      );
      if (!schoolRows[0]?.id) throw new BadRequestException('Institución no encontrada');
      return sid;
    }
    if (role !== UserRole.ADMINISTRATIVO && role !== UserRole.DOCENTE) {
      throw new ForbiddenException('Solo staff puede crear visitas');
    }
    if (!user.schoolId) throw new ForbiddenException('Usuario sin institución asignada');
    return user.schoolId;
  }

  private async assertScopeBelongsToSchool(
    schoolId: string,
    groupIds: string[],
    studentIds: string[]
  ): Promise<void> {
    if (groupIds.length > 0) {
      const rows = await this.dataSource.query<{ cnt: string }[]>(
        `SELECT COUNT(*)::text AS cnt FROM groups WHERE id = ANY($1::uuid[]) AND school_id = $2`,
        [groupIds, schoolId]
      );
      if (Number(rows[0]?.cnt ?? 0) !== groupIds.length) {
        throw new BadRequestException('Hay grupos que no pertenecen a la institución');
      }
    }
    if (studentIds.length > 0) {
      const rows = await this.dataSource.query<{ cnt: string }[]>(
        `SELECT COUNT(*)::text AS cnt FROM students s
         INNER JOIN groups g ON g.id = s.group_id
         WHERE s.id = ANY($1::uuid[]) AND g.school_id = $2`,
        [studentIds, schoolId]
      );
      if (Number(rows[0]?.cnt ?? 0) !== studentIds.length) {
        throw new BadRequestException('Hay estudiantes que no pertenecen a la institución');
      }
    }
  }

  private async assertTeacherOwnsScope(
    userId: string,
    groupIds: string[],
    studentIds: string[],
    scope: ExternalVisitAudienceScope
  ): Promise<void> {
    if (scope === ExternalVisitAudienceScope.SCHOOL) {
      throw new ForbiddenException('Un docente no puede crear visitas a toda la escuela');
    }
    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');
    if (groupIds.length > 0) {
      const rows = await this.dataSource.query<{ cnt: string }[]>(
        `SELECT COUNT(*)::text AS cnt FROM teacher_groups
         WHERE teacher_id = $1 AND group_id = ANY($2::uuid[])`,
        [teacher.id, groupIds]
      );
      if (Number(rows[0]?.cnt ?? 0) !== groupIds.length) {
        throw new ForbiddenException('El docente no tiene asignación en alguno de los grupos');
      }
    }
    if (studentIds.length > 0) {
      const rows = await this.dataSource.query<{ cnt: string }[]>(
        `SELECT COUNT(*)::text AS cnt FROM students s
         WHERE s.id = ANY($1::uuid[]) AND EXISTS (
           SELECT 1 FROM teacher_groups tg WHERE tg.teacher_id = $2 AND tg.group_id = s.group_id
         )`,
        [studentIds, teacher.id]
      );
      if (Number(rows[0]?.cnt ?? 0) !== studentIds.length) {
        throw new ForbiddenException('El docente no tiene asignación en el grupo de algún estudiante');
      }
    }
  }

  private async assertCanModify(
    id: string,
    userId: string,
    role: UserRole
  ): Promise<ExternalVisitEntity> {
    const visit = await this.visitsRepository.findOne({ where: { id } });
    if (!visit) throw new NotFoundException('Visita no encontrada');
    if (role === UserRole.ADMIN) return visit;
    if (visit.createdByUserId === userId) return visit;
    if (role === UserRole.ADMINISTRATIVO) {
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (user?.schoolId === visit.schoolId) return visit;
    }
    throw new ForbiddenException('No tienes permiso sobre esta visita');
  }

  private async assertCanView(
    visit: ExternalVisitEntity,
    userId: string,
    role: UserRole
  ): Promise<void> {
    if (role === UserRole.ADMIN) return;
    if (visit.createdByUserId === userId) return;
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (role === UserRole.ADMINISTRATIVO && user?.schoolId === visit.schoolId) return;
    const userIds = await this.audienceResolver.resolveForVisit({
      scope: visit.audienceScope,
      schoolId: visit.schoolId,
      groupIds: await this.loadVisitGroupIds(visit.id),
      studentIds: await this.loadVisitStudentIds(visit.id)
    });
    if (userIds.includes(userId)) return;
    throw new ForbiddenException('No tienes acceso a esta visita');
  }

  private async loadVisitGroupIds(visitId: string): Promise<string[]> {
    const rows = await this.visitGroupsRepository.find({ where: { visitId } });
    return rows.map((r) => r.groupId);
  }

  private async loadVisitStudentIds(visitId: string): Promise<string[]> {
    const rows = await this.visitStudentsRepository.find({ where: { visitId } });
    return rows.map((r) => r.studentId);
  }

  private async hydrate(visits: ExternalVisitEntity[]): Promise<VisitRow[]> {
    if (visits.length === 0) return [];
    const ids = visits.map((v) => v.id);
    const [groups, students] = await Promise.all([
      this.visitGroupsRepository.find({ where: { visitId: In(ids) } }),
      this.visitStudentsRepository.find({ where: { visitId: In(ids) } })
    ]);
    const byGroup = new Map<string, string[]>();
    for (const g of groups) {
      const list = byGroup.get(g.visitId) ?? [];
      list.push(g.groupId);
      byGroup.set(g.visitId, list);
    }
    const byStudent = new Map<string, string[]>();
    for (const s of students) {
      const list = byStudent.get(s.visitId) ?? [];
      list.push(s.studentId);
      byStudent.set(s.visitId, list);
    }
    return visits.map((v) => ({
      ...v,
      groupIds: byGroup.get(v.id) ?? [],
      studentIds: byStudent.get(v.id) ?? []
    }));
  }

  private normalizeRawRows(rows: Array<Record<string, unknown>>): ExternalVisitEntity[] {
    return rows.map((r) => {
      const visit = new ExternalVisitEntity();
      visit.id = r.id as string;
      visit.schoolId = r.school_id as string;
      visit.createdByUserId = r.created_by_user_id as string;
      visit.creatorRole = r.creator_role as string;
      visit.title = r.title as string;
      visit.purpose = r.purpose as string;
      visit.visitorName = r.visitor_name as string;
      visit.visitorOrganization = (r.visitor_organization as string | null) ?? null;
      visit.location = (r.location as string | null) ?? null;
      visit.visitDatetime = new Date(r.visit_datetime as string);
      visit.durationMinutes = Number(r.duration_minutes);
      visit.audienceScope = r.audience_scope as ExternalVisitAudienceScope;
      visit.status = r.status as ExternalVisitStatus;
      visit.cancellationReason = (r.cancellation_reason as string | null) ?? null;
      visit.previousDatetime = r.previous_datetime ? new Date(r.previous_datetime as string) : null;
      visit.reminded24hAt = r.reminded_24h_at ? new Date(r.reminded_24h_at as string) : null;
      visit.reminded1hAt = r.reminded_1h_at ? new Date(r.reminded_1h_at as string) : null;
      visit.autoFinalizedAt = r.auto_finalized_at ? new Date(r.auto_finalized_at as string) : null;
      visit.createdAt = new Date(r.created_at as string);
      visit.updatedAt = new Date(r.updated_at as string);
      return visit;
    });
  }
}
