import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, In, Repository } from 'typeorm';
import { AdminReportCommentEntity } from '../../database/entities/admin-report-comment.entity';
import {
  AdminReportEntity,
  AdminReportStatus,
  AdminReportType
} from '../../database/entities/admin-report.entity';
import { GroupEntity } from '../../database/entities/group.entity';
import { InstitutionSettingEntity } from '../../database/entities/institution-setting.entity';
import { NoticeEntity, NoticeTargetType } from '../../database/entities/notice.entity';
import { NotificationEntity } from '../../database/entities/notification.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { AdminReportCommentDto } from './dto/admin-report-comment.dto';
import { CreateAdminReportDto } from './dto/create-admin-report.dto';
import { UpdateAdminReportStatusDto } from './dto/update-admin-report-status.dto';
import { FcmService } from '../fcm/fcm.service';

type AdminReportRow = {
  id: string;
  schoolId: string;
  type: AdminReportType;
  subject: string;
  message: string;
  status: AdminReportStatus;
  createdAt: Date;
  createdByUserId: string;
  createdByName: string | null;
  assignedAdminUserId: string | null;
  assignedAdminName: string | null;
  resolvedByUserId?: string | null;
  resolvedAt?: Date | null;
  firstResponseAt: Date | null;
  slaResponseHours: number;
  slaResolutionHours: number;
  slaResponseStatus: 'OK' | 'PENDING' | 'BREACHED';
  slaResolutionStatus: 'OK' | 'PENDING' | 'BREACHED';
};

const DEFAULT_RESPONSE_SLA_H = 24;
const DEFAULT_RESOLUTION_SLA_H = 72;

const STAFF_REPORT_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE];

@Injectable()
export class NoticesService {
  private readonly logger = new Logger(NoticesService.name);

  constructor(
    @InjectRepository(NoticeEntity)
    private readonly noticesRepository: Repository<NoticeEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notificationsRepository: Repository<NotificationEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentsRepository: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachersRepository: Repository<TeacherEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupsRepository: Repository<GroupEntity>,
    @InjectRepository(AdminReportEntity)
    private readonly adminReportsRepository: Repository<AdminReportEntity>,
    @InjectRepository(AdminReportCommentEntity)
    private readonly adminReportCommentsRepository: Repository<AdminReportCommentEntity>,
    @InjectRepository(InstitutionSettingEntity)
    private readonly institutionSettingsRepository: Repository<InstitutionSettingEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly fcmService: FcmService
  ) {}

  async create(dto: CreateNoticeDto, createdByUserId: string, role: UserRole, schoolIdParam?: string) {
    this.validateTargets(dto);
    const scopeSchoolId = await this.ensureRoleScope(role, createdByUserId, dto, schoolIdParam);
    if (dto.targetType === NoticeTargetType.GROUP && dto.targetGroupId) {
      const exists = await this.groupsRepository.exist({ where: { id: dto.targetGroupId } });
      if (!exists) throw new BadRequestException('Grupo no encontrado');
    }
    if (dto.targetType === NoticeTargetType.USER && dto.targetUserId) {
      const exists = await this.usersRepository.exist({ where: { id: dto.targetUserId } });
      if (!exists) throw new BadRequestException('Usuario destino no encontrado');
    }
    const recipientIds = await this.resolveRecipientUserIds(dto, scopeSchoolId);
    const uniqueIds = [...new Set(recipientIds)];
    const notice = this.noticesRepository.create({
      title: dto.title,
      content: dto.content,
      targetType: dto.targetType,
      targetUserId: dto.targetType === NoticeTargetType.USER ? (dto.targetUserId ?? null) : null,
      targetGroupId: dto.targetType === NoticeTargetType.GROUP ? (dto.targetGroupId ?? null) : null,
      createdBy: createdByUserId,
      isImportant: dto.isImportant ?? false,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null
    });
    const saved = await this.noticesRepository.save(notice);
    if (uniqueIds.length > 0) {
      const rows = uniqueIds.map((userId) =>
        this.notificationsRepository.create({
          userId,
          noticeId: saved.id,
          title: saved.title,
          message: saved.content,
          deliveryStatus: 'SENT'
        })
      );
      const savedRows = await this.notificationsRepository.save(rows);
      void this.fcmService.sendPushForNotifications(savedRows).catch((err: unknown) => {
        this.logger.warn(`Push FCM no enviado: ${String(err)}`);
      });
    }
    return {
      message: 'Aviso creado y notificaciones generadas',
      noticeId: saved.id,
      recipientsCount: uniqueIds.length
    };
  }

  async list(page = 1, limit = 20, createdByUserId: string, role: UserRole, schoolIdParam?: string) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const qb = this.noticesRepository.createQueryBuilder('n').orderBy('n.createdAt', 'DESC');
    if (role === UserRole.ADMIN && createdByUserId) {
      qb.andWhere('n.created_by = :uid', { uid: createdByUserId });
    } else if (role === UserRole.DOCENTE && createdByUserId) {
      qb.andWhere('n.created_by = :uid', { uid: createdByUserId });
    }
    if (role === UserRole.ADMIN && schoolIdParam) {
      const schoolUsers = await this.usersRepository.find({
        where: { schoolId: schoolIdParam },
        select: ['id']
      });
      const ids = schoolUsers.map((u) => u.id);
      if (ids.length === 0) {
        return { data: [], meta: { total: 0, page: Math.max(page, 1), limit: take, pages: 0 } };
      }
      qb.andWhere('n.created_by IN (:...ids)', { ids });
    }
    const [items, total] = await qb.skip(skip).take(take).getManyAndCount();
    return {
      data: items,
      meta: { total, page: Math.max(page, 1), limit: take, pages: Math.ceil(total / take) }
    };
  }

  async listMyNotifications(userId: string, page = 1, limit = 30) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const [items, total] = await this.notificationsRepository
      .createQueryBuilder('n')
      .where('n.user_id = :userId', { userId })
      .orderBy('n.sent_at', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();
    return {
      data: items,
      meta: { total, page: Math.max(page, 1), limit: take, pages: Math.ceil(total / take) }
    };
  }

  async listMyChildrenNotifications(parentUserId: string, page = 1, limit = 30) {
    const parent = await this.dataSource.query<{ id: string }[]>(
      `SELECT id FROM parents WHERE user_id = $1 LIMIT 1`,
      [parentUserId]
    );
    const parentId = parent[0]?.id;
    if (!parentId) throw new ForbiddenException('Perfil padre no encontrado');

    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const rows = await this.dataSource.query<{
      id: string;
      userId: string;
      noticeId: string | null;
      title: string;
      message: string;
      readAt: string | null;
      sentAt: string;
      deliveryStatus: string;
      studentName: string;
    }[]>(
      `SELECT n.id,
              n.user_id AS "userId",
              n.notice_id AS "noticeId",
              n.title,
              n.message,
              n.read_at AS "readAt",
              n.sent_at AS "sentAt",
              n.delivery_status AS "deliveryStatus",
              su.full_name AS "studentName"
       FROM notifications n
       JOIN users u ON u.id = n.user_id
       JOIN students s ON s.user_id = u.id
       JOIN users su ON su.id = s.user_id
       JOIN student_parents sp ON sp.student_id = s.id
       WHERE sp.parent_id = $1
       ORDER BY n.sent_at DESC
       LIMIT $2 OFFSET $3`,
      [parentId, take, skip]
    );
    const countRows = await this.dataSource.query<{ total: string }[]>(
      `SELECT COUNT(*)::text AS total
       FROM notifications n
       JOIN users u ON u.id = n.user_id
       JOIN students s ON s.user_id = u.id
       JOIN student_parents sp ON sp.student_id = s.id
       WHERE sp.parent_id = $1`,
      [parentId]
    );
    const total = Number.parseInt(countRows[0]?.total ?? '0', 10);
    return {
      data: rows,
      meta: { total, page: Math.max(page, 1), limit: take, pages: Math.ceil(total / take) }
    };
  }

  /** Grupos en los que el docente tiene asignación (para publicar avisos a un grupo). */
  async listTeacherGroupsForNotices(teacherUserId: string): Promise<
    Array<{ id: string; name: string; grade: string | null; schoolYear: string }>
  > {
    const teacher = await this.ensureTeacherProfile(teacherUserId);
    const rows = await this.dataSource.query<
      { id: string; name: string; grade: string | null; school_year: string }[]
    >(
      `SELECT DISTINCT g.id, g.name, g.grade, g.school_year AS school_year
       FROM teacher_groups tg
       INNER JOIN groups g ON g.id = tg.group_id
       WHERE tg.teacher_id = $1
       ORDER BY g.school_year DESC, g.name ASC`,
      [teacher.id]
    );
    return rows.map((r) => ({ id: r.id, name: r.name, grade: r.grade, schoolYear: r.school_year }));
  }

  /** Alumnos y padres vinculados a los grupos del docente (destinatarios de aviso individual). */
  async searchNoticeTargetsForTeacher(
    teacherUserId: string,
    q?: string
  ): Promise<Array<{ userId: string; fullName: string; email: string; kind: string }>> {
    const teacher = await this.ensureTeacherProfile(teacherUserId);
    const like = q?.trim() ? `%${q.trim().toLowerCase()}%` : null;
    const rows = await this.dataSource.query<
      { user_id: string; full_name: string; email: string; kind: string }[]
    >(
      `WITH scope AS (
         SELECT DISTINCT s.user_id AS uid, 'ALUMNO'::text AS kind
         FROM teacher_groups tg
         INNER JOIN students s ON s.group_id = tg.group_id
         WHERE tg.teacher_id = $1
         UNION
         SELECT DISTINCT u.id AS uid, 'PADRE'::text AS kind
         FROM teacher_groups tg
         INNER JOIN students s ON s.group_id = tg.group_id
         INNER JOIN student_parents sp ON sp.student_id = s.id
         INNER JOIN parents p ON p.id = sp.parent_id
         INNER JOIN users u ON u.id = p.user_id
         WHERE tg.teacher_id = $1
       )
       SELECT u.id AS user_id, u.full_name, u.email, sc.kind
       FROM scope sc
       INNER JOIN users u ON u.id = sc.uid
       WHERE ($2::text IS NULL OR (
         LOWER(u.full_name) LIKE $2 OR LOWER(COALESCE(u.email, '')) LIKE $2
       ))
       ORDER BY u.full_name ASC
       LIMIT 80`,
      [teacher.id, like]
    );
    return rows.map((r) => ({ userId: r.user_id, fullName: r.full_name, email: r.email ?? '', kind: r.kind }));
  }

  async listCriticalNoticeReadReceipts(
    createdByUserId: string,
    role: UserRole,
    opts?: { page?: number; limit?: number; schoolId?: string }
  ) {
    const page = Math.max(1, opts?.page ?? 1);
    const take = Math.min(Math.max(opts?.limit ?? 20, 1), 100);
    const skip = (page - 1) * take;
    const requestedSchoolId = opts?.schoolId?.trim() || undefined;

    const currentUser = await this.usersRepository.findOne({
      where: { id: createdByUserId },
      select: ['id', 'schoolId', 'role']
    });
    if (!currentUser) throw new ForbiddenException('Usuario no encontrado');

    const qb = this.noticesRepository
      .createQueryBuilder('n')
      .where('n.is_important = true')
      .andWhere('n.created_by = :createdBy', { createdBy: createdByUserId })
      .orderBy('n.created_at', 'DESC');
    if (role === UserRole.ADMIN && requestedSchoolId) {
      const schoolUsers = await this.usersRepository.find({
        where: { schoolId: requestedSchoolId },
        select: ['id']
      });
      const ids = schoolUsers.map((u) => u.id);
      if (ids.length === 0) {
        return { data: [], meta: { total: 0, page, limit: take, pages: 0 }, summary: { totalRecipients: 0, read: 0, unread: 0 } };
      }
      qb.andWhere('n.created_by IN (:...ids)', { ids });
    } else if (role === UserRole.ADMINISTRATIVO) {
      if (!currentUser.schoolId) throw new ForbiddenException('Usuario sin escuela asignada');
      const schoolUsers = await this.usersRepository.find({
        where: { schoolId: currentUser.schoolId },
        select: ['id']
      });
      const ids = schoolUsers.map((u) => u.id);
      if (ids.length > 0) qb.andWhere('n.created_by IN (:...ids)', { ids });
    }

    const [notices, total] = await qb.skip(skip).take(take).getManyAndCount();
    if (notices.length === 0) {
      return { data: [], meta: { total, page, limit: take, pages: Math.ceil(total / take) }, summary: { totalRecipients: 0, read: 0, unread: 0 } };
    }
    const noticeIds = notices.map((n) => n.id);
    const raw = await this.notificationsRepository
      .createQueryBuilder('nf')
      .select('nf.noticeId', 'noticeId')
      .addSelect('COUNT(*)::int', 'total')
      .addSelect("COUNT(*) FILTER (WHERE nf.read_at IS NOT NULL)::int", 'read')
      .where('nf.notice_id IN (:...ids)', { ids: noticeIds })
      .groupBy('nf.notice_id')
      .getRawMany<{ noticeId: string; total: number; read: number }>();
    const byNotice = new Map(raw.map((r) => [r.noticeId, { total: Number(r.total), read: Number(r.read) }]));
    const data = notices.map((n) => {
      const agg = byNotice.get(n.id) ?? { total: 0, read: 0 };
      const unread = Math.max(0, agg.total - agg.read);
      return {
        noticeId: n.id,
        title: n.title,
        createdAt: n.createdAt,
        totalRecipients: agg.total,
        readCount: agg.read,
        unreadCount: unread,
        readRate: agg.total > 0 ? Number(((agg.read / agg.total) * 100).toFixed(1)) : 0
      };
    });
    const summary = data.reduce(
      (acc, row) => ({ totalRecipients: acc.totalRecipients + row.totalRecipients, read: acc.read + row.readCount, unread: acc.unread + row.unreadCount }),
      { totalRecipients: 0, read: 0, unread: 0 }
    );
    return { data, meta: { total, page, limit: take, pages: Math.ceil(total / take) }, summary };
  }

  async sendCriticalReadReminders(opts?: { schoolId?: string; minHoursSinceNotice?: number; maxNotices?: number }) {
    const minHours = Math.max(1, opts?.minHoursSinceNotice ?? 6);
    const maxNotices = Math.min(Math.max(opts?.maxNotices ?? 30, 1), 200);
    const since = new Date(Date.now() - minHours * 60 * 60 * 1000);
    const noticesQb = this.noticesRepository
      .createQueryBuilder('n')
      .where('n.is_important = true')
      .andWhere('n.created_at <= :since', { since: since.toISOString() })
      .orderBy('n.created_at', 'DESC')
      .take(maxNotices);
    if (opts?.schoolId?.trim()) {
      const users = await this.usersRepository.find({ where: { schoolId: opts.schoolId.trim() }, select: ['id'] });
      const ids = users.map((u) => u.id);
      if (ids.length === 0) return { noticesChecked: 0, remindersCreated: 0 };
      noticesQb.andWhere('n.created_by IN (:...ids)', { ids });
    }
    const notices = await noticesQb.getMany();
    if (notices.length === 0) return { noticesChecked: 0, remindersCreated: 0 };
    let remindersCreated = 0;
    for (const notice of notices) {
      const unreadRows = await this.notificationsRepository.find({
        where: { noticeId: notice.id, readAt: IsNull() },
        select: ['id', 'userId']
      });
      if (unreadRows.length === 0) continue;
      const userIds = [...new Set(unreadRows.map((r) => r.userId))];
      const alreadyReminded = await this.notificationsRepository
        .createQueryBuilder('nf')
        .select('nf.userId', 'userId')
        .where('nf.user_id IN (:...uids)', { uids: userIds })
        .andWhere('nf.title = :title', { title: `[Recordatorio lectura] ${notice.title}` })
        .andWhere('nf.message LIKE :msg', { msg: `%Notice ID: ${notice.id}%` })
        .getRawMany<{ userId: string }>();
      const remindedSet = new Set(alreadyReminded.map((r) => r.userId));
      const pendingUsers = userIds.filter((id) => !remindedSet.has(id));
      if (pendingUsers.length === 0) continue;
      const toCreate = pendingUsers.map((userId) =>
        this.notificationsRepository.create({
          userId,
          noticeId: notice.id,
          title: `[Recordatorio lectura] ${notice.title}`,
          message: `Tienes un comunicado crítico pendiente de lectura. Notice ID: ${notice.id}`,
          deliveryStatus: 'SENT'
        })
      );
      const saved = await this.notificationsRepository.save(toCreate);
      remindersCreated += saved.length;
      void this.fcmService.sendPushForNotifications(saved).catch((err: unknown) => {
        this.logger.warn(`Push FCM de recordatorio crítico no enviado: ${String(err)}`);
      });
    }
    return { noticesChecked: notices.length, remindersCreated };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notif = await this.notificationsRepository.findOne({ where: { id: notificationId, userId } });
    if (!notif) throw new NotFoundException('Notificación no encontrada');
    notif.readAt = new Date();
    await this.notificationsRepository.save(notif);
    return { message: 'Marcada como leída', id: notif.id };
  }

  async createAdminReport(dto: CreateAdminReportDto, createdByUserId: string, role: UserRole) {
    const schoolId = await this.resolveSchoolIdForReporter(createdByUserId, role);
    let message = dto.message;
    if (dto.evidenceUrls?.length) {
      message = `${dto.message}\n\n[Evidencias]\n${dto.evidenceUrls.join('\n')}`;
    }
    const row = this.adminReportsRepository.create({
      schoolId,
      createdByUserId,
      assignedAdminUserId: null,
      type: dto.type as AdminReportType,
      subject: dto.subject.trim(),
      message,
      status: AdminReportStatus.PENDIENTE,
      resolvedByUserId: null,
      resolvedAt: null
    });
    await this.adminReportsRepository.save(row);
    return { message: 'Reporte registrado ante administración.', id: row.id };
  }

  async listAdminReports(
    userId: string,
    role: UserRole,
    query: {
      schoolId?: string;
      type?: string;
      status?: string;
      q?: string;
      unreadOnly?: string;
      limit?: string;
    }
  ) {
    if (role !== UserRole.ADMIN) throw new ForbiddenException('Solo administración de la plataforma puede listar todos los reportes');
    const take = Math.min(Math.max(Number.parseInt(query.limit ?? '40', 10) || 40, 1), 200);
    const qb = this.adminReportsRepository.createQueryBuilder('r').orderBy('r.createdAt', 'DESC').take(take);
    const sid = query.schoolId?.trim();
    if (sid) qb.andWhere('r.schoolId = :sid', { sid });
    if (query.type?.trim()) qb.andWhere('r.type = :t', { t: query.type.trim() });
    if (query.status?.trim()) qb.andWhere('r.status = :st', { st: query.status.trim() });
    const qtxt = query.q?.trim().toLowerCase();
    if (qtxt) {
      qb.andWhere(
        `(LOWER(r.subject) LIKE :q OR LOWER(r.message) LIKE :q OR EXISTS (
           SELECT 1 FROM users uc WHERE uc.id = r.createdByUserId AND (LOWER(uc.full_name) LIKE :q OR LOWER(COALESCE(uc.email, '')) LIKE :q)
         ))`,
        { q: `%${qtxt}%` }
      );
    }
    if (query.unreadOnly === 'true' || query.unreadOnly === '1') {
      qb.andWhere(
        `NOT EXISTS (
          SELECT 1 FROM admin_report_comments c
          INNER JOIN users u ON u.id = c.user_id
          WHERE c.report_id = r.id AND u.role::text IN (:...staffRoles)
        )`,
        { staffRoles: STAFF_REPORT_ROLES }
      );
      qb.andWhere('r.status = :pend', { pend: AdminReportStatus.PENDIENTE });
    }
    const rows = await qb.getMany();
    const enriched = await this.enrichReportsWithSla(rows);
    return {
      data: enriched.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
        resolvedAt: e.resolvedAt ? e.resolvedAt.toISOString() : null,
        firstResponseAt: e.firstResponseAt ? e.firstResponseAt.toISOString() : null
      }))
    };
  }

  async listMyAdminReports(userId: string, role: UserRole, query: { limit?: string }) {
    if (role !== UserRole.ADMINISTRATIVO) throw new ForbiddenException('Solo disponible para personal administrativo');
    const me = await this.usersRepository.findOne({ where: { id: userId }, select: ['schoolId'] });
    if (!me?.schoolId) throw new ForbiddenException('Usuario sin escuela asignada');
    const take = Math.min(Math.max(Number.parseInt(query.limit ?? '30', 10) || 30, 1), 100);
    const rows = await this.adminReportsRepository.find({
      where: { schoolId: me.schoolId },
      order: { createdAt: 'DESC' },
      take
    });
    const enriched = await this.enrichReportsWithSla(rows);
    return {
      data: enriched.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
        resolvedAt: e.resolvedAt ? e.resolvedAt.toISOString() : null,
        firstResponseAt: e.firstResponseAt ? e.firstResponseAt.toISOString() : null
      }))
    };
  }

  async getAdminReportsSlaSummary(viewerUserId: string, role: UserRole, schoolId?: string) {
    if (role !== UserRole.ADMIN) throw new ForbiddenException('Solo administración de la plataforma');
    const { responseH, resolutionH } = await this.getSlaHoursConfig();
    const qb = this.adminReportsRepository.createQueryBuilder('r');
    if (schoolId?.trim()) qb.where('r.schoolId = :sid', { sid: schoolId.trim() });
    const all = await qb.orderBy('r.createdAt', 'DESC').take(1500).getMany();
    if (all.length === 0) {
      return {
        total: 0,
        pending: 0,
        inProgress: 0,
        resolved: 0,
        responseBreached: 0,
        resolutionBreached: 0,
        avgResponseHours: null,
        avgResolutionHours: null,
        responseSlaHours: responseH,
        resolutionSlaHours: resolutionH
      };
    }
    const enriched = await this.enrichReportsWithSla(all);
    const pending = enriched.filter((r) => r.status === AdminReportStatus.PENDIENTE).length;
    const inProgress = enriched.filter((r) => r.status === AdminReportStatus.EN_PROCESO).length;
    const resolved = enriched.filter((r) => r.status === AdminReportStatus.RESUELTO).length;
    const responseBreached = enriched.filter((r) => r.slaResponseStatus === 'BREACHED').length;
    const resolutionBreached = enriched.filter((r) => r.slaResolutionStatus === 'BREACHED').length;
    const respHs = enriched
      .filter((r) => r.firstResponseAt)
      .map((r) => (r.firstResponseAt!.getTime() - r.createdAt.getTime()) / 3_600_000);
    const resHs = enriched
      .filter((r) => r.status === AdminReportStatus.RESUELTO && r.resolvedAt)
      .map((r) => (r.resolvedAt!.getTime() - r.createdAt.getTime()) / 3_600_000);
    const avgResponseHours =
      respHs.length > 0 ? Number((respHs.reduce((a, b) => a + b, 0) / respHs.length).toFixed(2)) : null;
    const avgResolutionHours =
      resHs.length > 0 ? Number((resHs.reduce((a, b) => a + b, 0) / resHs.length).toFixed(2)) : null;
    return {
      total: enriched.length,
      pending,
      inProgress,
      resolved,
      responseBreached,
      resolutionBreached,
      avgResponseHours,
      avgResolutionHours,
      responseSlaHours: responseH,
      resolutionSlaHours: resolutionH
    };
  }

  /** Dispara recordatorios de comunicados críticos sin leer (misma lógica que avisos importantes). */
  async runAdminReportsSlaReminders(userId: string, role: UserRole, schoolId?: string) {
    if (role !== UserRole.ADMIN) throw new ForbiddenException('Solo administración de la plataforma');
    const summary = await this.sendCriticalReadReminders({ schoolId: schoolId?.trim() });
    return {
      message: 'Recordatorios de lectura de comunicados críticos ejecutados',
      remindersCreated: summary.remindersCreated,
      noticesChecked: summary.noticesChecked
    };
  }

  async listAdminReportComments(reportId: string, userId: string, role: UserRole) {
    await this.assertCanAccessAdminReport(reportId, userId, role);
    const rows = await this.adminReportCommentsRepository.find({
      where: { reportId },
      order: { createdAt: 'ASC' }
    });
    const userIds = [...new Set(rows.map((r) => r.userId))];
    const authors =
      userIds.length > 0
        ? await this.usersRepository.find({
            where: { id: In(userIds) },
            select: ['id', 'fullName', 'role']
          })
        : [];
    const byId = new Map(authors.map((u) => [u.id, u]));
    return rows.map((c) => {
      const u = byId.get(c.userId);
      return {
        id: c.id,
        reportId: c.reportId,
        userId: c.userId,
        message: c.message,
        createdAt: c.createdAt.toISOString(),
        authorName: u?.fullName ?? null,
        authorRole: u?.role ?? null
      };
    });
  }

  async addAdminReportComment(
    reportId: string,
    dto: AdminReportCommentDto,
    userId: string,
    role: UserRole
  ) {
    await this.assertCanAccessAdminReport(reportId, userId, role);
    const comment = this.adminReportCommentsRepository.create({
      reportId,
      userId,
      message: dto.message.trim()
    });
    await this.adminReportCommentsRepository.save(comment);
    const report = await this.adminReportsRepository.findOne({ where: { id: reportId } });
    if (report && STAFF_REPORT_ROLES.includes(role) && report.createdByUserId !== userId) {
      if (report.status === AdminReportStatus.PENDIENTE) {
        report.status = AdminReportStatus.EN_PROCESO;
        if (!report.assignedAdminUserId) report.assignedAdminUserId = userId;
        await this.adminReportsRepository.save(report);
      }
    }
    return { message: 'Comentario publicado.', id: comment.id };
  }

  async updateAdminReportStatus(
    reportId: string,
    dto: UpdateAdminReportStatusDto,
    userId: string,
    role: UserRole
  ) {
    if (role !== UserRole.ADMIN && role !== UserRole.ADMINISTRATIVO) {
      throw new ForbiddenException('No autorizado a actualizar estado del reporte');
    }
    const report = await this.adminReportsRepository.findOne({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Reporte no encontrado');
    if (role === UserRole.ADMINISTRATIVO) {
      const u = await this.usersRepository.findOne({ where: { id: userId }, select: ['schoolId'] });
      if (!u?.schoolId || u.schoolId !== report.schoolId) throw new ForbiddenException('Sin acceso a este reporte');
    }

    report.status = dto.status;
    if (dto.status === AdminReportStatus.EN_PROCESO) {
      if (!report.assignedAdminUserId && STAFF_REPORT_ROLES.includes(role)) {
        report.assignedAdminUserId = userId;
      }
    }
    if (dto.status === AdminReportStatus.RESUELTO) {
      report.resolvedByUserId = userId;
      report.resolvedAt = new Date();
    }
    await this.adminReportsRepository.save(report);
    return { message: 'Estado actualizado', id: report.id, status: report.status };
  }

  private async resolveSchoolIdForReporter(userId: string, role: UserRole): Promise<string> {
    const user = await this.usersRepository.findOne({ where: { id: userId }, select: ['id', 'schoolId'] });
    if (user?.schoolId) return user.schoolId;

    if (role === UserRole.PADRE) {
      const rows = await this.dataSource.query<{ school_id: string }[]>(
        `SELECT DISTINCT s.school_id
         FROM student_parents sp
         JOIN students s ON s.id = sp.student_id
         JOIN parents p ON p.id = sp.parent_id
         WHERE p.user_id = $1
         LIMIT 1`,
        [userId]
      );
      const sid = rows[0]?.school_id;
      if (!sid) throw new BadRequestException('No se pudo determinar la institución del reporte');
      return sid;
    }
    if (role === UserRole.ALUMNO) {
      const st = await this.studentsRepository.findOne({ where: { userId }, select: ['schoolId'] });
      if (!st?.schoolId) throw new BadRequestException('Estudiante sin institución');
      return st.schoolId;
    }

    throw new BadRequestException('Usuario sin institución asignada para crear reportes');
  }

  private async getSlaHoursConfig(): Promise<{ responseH: number; resolutionH: number }> {
    let responseH = DEFAULT_RESPONSE_SLA_H;
    let resolutionH = DEFAULT_RESOLUTION_SLA_H;
    try {
      const rk = await this.institutionSettingsRepository.findOne({
        where: { settingKey: 'admin_report.response_sla_hours' }
      });
      const uk = await this.institutionSettingsRepository.findOne({
        where: { settingKey: 'admin_report.resolution_sla_hours' }
      });
      if (rk?.value?.trim()) {
        const n = Number.parseFloat(rk.value.trim());
        if (!Number.isNaN(n) && n > 0 && n <= 8760) responseH = n;
      }
      if (uk?.value?.trim()) {
        const n = Number.parseFloat(uk.value.trim());
        if (!Number.isNaN(n) && n > 0 && n <= 8760) resolutionH = n;
      }
    } catch {
      /* usar defaults */
    }
    return { responseH: responseH, resolutionH: resolutionH };
  }

  private async enrichReportsWithSla(reports: AdminReportEntity[]): Promise<AdminReportRow[]> {
    if (reports.length === 0) return [];
    const { responseH, resolutionH } = await this.getSlaHoursConfig();
    const ids = reports.map((r) => r.id);
    const firstRespRaw = await this.dataSource.query<{ report_id: string; fr: Date }[]>(
      `SELECT c.report_id, MIN(c.created_at) AS fr
       FROM admin_report_comments c
       INNER JOIN users u ON u.id = c.user_id
       WHERE c.report_id = ANY($1::uuid[])
         AND u.role::text = ANY($2::text[])
       GROUP BY c.report_id`,
      [ids, STAFF_REPORT_ROLES]
    );
    const firstByReport = new Map(firstRespRaw.map((r) => [r.report_id, new Date(r.fr)]));

    const uids = [...new Set(reports.flatMap((r) => [r.createdByUserId, r.assignedAdminUserId].filter(Boolean) as string[]))];
    const users = uids.length
      ? await this.usersRepository.find({ where: { id: In(uids) }, select: ['id', 'fullName'] })
      : [];
    const nameByUser = new Map(users.map((u) => [u.id, u.fullName]));

    const now = Date.now();
    return reports.map((r) => {
      const firstResponseAt = firstByReport.get(r.id) ?? null;
      let slaResponseHours = 0;
      let slaResponseStatus: AdminReportRow['slaResponseStatus'] = 'PENDING';
      if (firstResponseAt) {
        slaResponseHours = Number(((firstResponseAt.getTime() - r.createdAt.getTime()) / 3_600_000).toFixed(2));
        slaResponseHours = Math.max(0, slaResponseHours);
        slaResponseStatus = slaResponseHours <= responseH ? 'OK' : 'BREACHED';
      } else {
        const elapsedH = (now - r.createdAt.getTime()) / 3_600_000;
        slaResponseHours = Number(elapsedH.toFixed(2));
        slaResponseStatus = elapsedH > responseH ? 'BREACHED' : 'PENDING';
      }

      let slaResolutionHours = 0;
      let slaResolutionStatus: AdminReportRow['slaResolutionStatus'] = 'PENDING';
      if (r.status === AdminReportStatus.RESUELTO && r.resolvedAt) {
        slaResolutionHours = Number(((r.resolvedAt.getTime() - r.createdAt.getTime()) / 3_600_000).toFixed(2));
        slaResolutionHours = Math.max(0, slaResolutionHours);
        slaResolutionStatus = slaResolutionHours <= resolutionH ? 'OK' : 'BREACHED';
      } else {
        const elapsedH = (now - r.createdAt.getTime()) / 3_600_000;
        slaResolutionHours = Number(elapsedH.toFixed(2));
        slaResolutionStatus = elapsedH > resolutionH ? 'BREACHED' : 'PENDING';
      }

      return {
        id: r.id,
        schoolId: r.schoolId,
        type: r.type,
        subject: r.subject,
        message: r.message,
        status: r.status,
        createdAt: r.createdAt,
        createdByUserId: r.createdByUserId,
        createdByName: nameByUser.get(r.createdByUserId) ?? null,
        assignedAdminUserId: r.assignedAdminUserId,
        assignedAdminName: r.assignedAdminUserId ? nameByUser.get(r.assignedAdminUserId!) ?? null : null,
        resolvedByUserId: r.resolvedByUserId,
        resolvedAt: r.resolvedAt,
        firstResponseAt,
        slaResponseHours,
        slaResolutionHours,
        slaResponseStatus,
        slaResolutionStatus
      };
    });
  }

  private async assertCanAccessAdminReport(
    reportId: string,
    userId: string,
    role: UserRole
  ): Promise<AdminReportEntity> {
    const report = await this.adminReportsRepository.findOne({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Reporte no encontrado');

    if (role === UserRole.ADMIN) return report;

    if (role === UserRole.ADMINISTRATIVO) {
      const u = await this.usersRepository.findOne({ where: { id: userId }, select: ['schoolId'] });
      if (!u?.schoolId || u.schoolId !== report.schoolId) throw new ForbiddenException('Sin acceso a este reporte');
      return report;
    }

    if (role === UserRole.DOCENTE) {
      const rows = await this.dataSource.query<{ ok: boolean }[]>(
        `SELECT EXISTS (
          SELECT 1 FROM teacher_groups tg
          INNER JOIN teachers t ON t.id = tg.teacher_id
          INNER JOIN groups g ON g.id = tg.group_id
          WHERE t.user_id = $1 AND g.school_id = $2
        ) AS ok`,
        [userId, report.schoolId]
      );
      if (!rows[0]?.ok) throw new ForbiddenException('Sin acceso a este reporte');
      return report;
    }

    if (report.createdByUserId !== userId) {
      throw new ForbiddenException('Sin acceso a este reporte');
    }

    if (role === UserRole.ALUMNO) {
      const st = await this.studentsRepository.findOne({ where: { userId }, select: ['schoolId'] });
      if (st?.schoolId !== report.schoolId) throw new ForbiddenException('Sin acceso a este reporte');
      return report;
    }
    if (role === UserRole.PADRE) {
      const rows = await this.dataSource.query<{ ok: boolean }[]>(
        `SELECT EXISTS (
          SELECT 1 FROM parents p
          INNER JOIN student_parents sp ON sp.parent_id = p.id
          INNER JOIN students s ON s.id = sp.student_id
          WHERE p.user_id = $1 AND s.school_id = $2
        ) AS ok`,
        [userId, report.schoolId]
      );
      if (!rows[0]?.ok) throw new ForbiddenException('Sin acceso a este reporte');
      return report;
    }

    throw new ForbiddenException('Sin acceso a este reporte');
  }

  private async ensureTeacherProfile(userId: string): Promise<TeacherEntity> {
    const existing = await this.teachersRepository.findOne({ where: { userId } });
    if (existing) return existing;
    const placeholder = `SE-${userId.slice(0, 8).toUpperCase()}`;
    const created = this.teachersRepository.create({ userId, employeeNumber: placeholder });
    return this.teachersRepository.save(created);
  }

  private validateTargets(dto: CreateNoticeDto) {
    if (dto.targetType === NoticeTargetType.ALL) {
      if (dto.targetUserId || dto.targetGroupId) {
        throw new BadRequestException('Para ALL no debe enviar targetUserId ni targetGroupId');
      }
      if (dto.targetRole && !Object.values(UserRole).includes(dto.targetRole)) {
        throw new BadRequestException('targetRole inválido');
      }
    }
    if (dto.targetType === NoticeTargetType.USER && !dto.targetUserId) {
      throw new BadRequestException('targetUserId es obligatorio para USER');
    }
    if (dto.targetType === NoticeTargetType.GROUP && !dto.targetGroupId) {
      throw new BadRequestException('targetGroupId es obligatorio para GROUP');
    }
    if (dto.targetType !== NoticeTargetType.ALL && dto.targetRole) {
      throw new BadRequestException('targetRole solo aplica cuando targetType=ALL');
    }
  }

  private async ensureRoleScope(
    role: UserRole,
    userId: string,
    dto: CreateNoticeDto,
    schoolIdParam?: string
  ): Promise<string | null> {
    if (role === UserRole.ADMIN) {
      const sid = schoolIdParam?.trim();
      if (!sid) {
        if (dto.targetType !== NoticeTargetType.ALL) {
          throw new BadRequestException('Seleccione una institución para avisos por grupo o por usuario.');
        }
        return null;
      }
      const schoolRows = await this.dataSource.query<{ id: string }[]>(
        `SELECT id FROM schools WHERE id = $1 LIMIT 1`,
        [sid]
      );
      if (!schoolRows[0]?.id) throw new BadRequestException('Institución no encontrada');
      return sid;
    }
    if (role === UserRole.ADMINISTRATIVO) {
      const adminUser = await this.usersRepository.findOne({ where: { id: userId }, select: ['schoolId'] });
      if (!adminUser?.schoolId) throw new ForbiddenException('Personal administrativo sin escuela asignada');
      if (dto.targetType === NoticeTargetType.USER && dto.targetUserId) {
        const target = await this.usersRepository.findOne({ where: { id: dto.targetUserId }, select: ['schoolId'] });
        if (!target || target.schoolId !== adminUser.schoolId) {
          throw new ForbiddenException('Usuario destino fuera de tu institución');
        }
      }
      if (dto.targetType === NoticeTargetType.GROUP && dto.targetGroupId) {
        const group = await this.groupsRepository.findOne({ where: { id: dto.targetGroupId }, select: ['schoolId'] });
        if (!group || group.schoolId !== adminUser.schoolId) {
          throw new ForbiddenException('Grupo fuera de tu institución');
        }
      }
      return adminUser.schoolId;
    }
    if (role === UserRole.DOCENTE) {
      if (dto.targetType === NoticeTargetType.ALL) {
        throw new ForbiddenException('Docente no puede enviar avisos a todo el plantel');
      }
      const teacher = await this.ensureTeacherProfile(userId);
      if (dto.targetType === NoticeTargetType.GROUP) {
        const rows = await this.dataSource.query<{ exists: boolean }[]>(
          `SELECT EXISTS (SELECT 1 FROM teacher_groups WHERE teacher_id = $1 AND group_id = $2) AS exists`,
          [teacher.id, dto.targetGroupId]
        );
        if (!rows[0]?.exists) throw new ForbiddenException('No tienes asignación en ese grupo');
      }
      if (dto.targetType === NoticeTargetType.USER && dto.targetUserId) {
        const rows = await this.dataSource.query<{ ok: boolean }[]>(
          `SELECT EXISTS (
            SELECT 1 FROM users target
            WHERE target.id = $1
              AND (
                EXISTS (SELECT 1 FROM students s INNER JOIN teacher_groups tg ON tg.group_id = s.group_id WHERE s.user_id = target.id AND tg.teacher_id = $2)
                OR EXISTS (SELECT 1 FROM student_parents sp INNER JOIN students s ON s.id = sp.student_id INNER JOIN teacher_groups tg ON tg.group_id = s.group_id INNER JOIN parents p ON p.id = sp.parent_id WHERE p.user_id = target.id AND tg.teacher_id = $2)
              )
          ) AS ok`,
          [dto.targetUserId, teacher.id]
        );
        if (!rows[0]?.ok) throw new ForbiddenException('Usuario destino fuera de tus grupos asignados');
      }
    }
    return null;
  }

  private async resolveRecipientUserIds(dto: CreateNoticeDto, scopeSchoolId?: string | null): Promise<string[]> {
    if (dto.targetType === NoticeTargetType.ALL) {
      const qb = this.usersRepository.createQueryBuilder('u').select(['u.id']).where('u.status = :st', { st: true });
      if (dto.targetRole) qb.andWhere('u.role = :role', { role: dto.targetRole });
      if (scopeSchoolId) qb.andWhere('u.school_id = :sid', { sid: scopeSchoolId });
      const users = await qb.getMany();
      return users.map((u) => u.id);
    }
    if (dto.targetType === NoticeTargetType.USER && dto.targetUserId) {
      return [dto.targetUserId];
    }
    if (dto.targetType === NoticeTargetType.GROUP && dto.targetGroupId) {
      const ids = new Set<string>();
      const students = await this.studentsRepository.find({ where: { groupId: dto.targetGroupId }, select: ['userId'] });
      students.forEach((s) => ids.add(s.userId));
      const teachers = await this.dataSource.query<{ user_id: string }[]>(
        `SELECT t.user_id FROM teacher_groups tg INNER JOIN teachers t ON t.id = tg.teacher_id WHERE tg.group_id = $1`,
        [dto.targetGroupId]
      );
      teachers.forEach((r) => ids.add(r.user_id));
      const parents = await this.dataSource.query<{ user_id: string }[]>(
        `SELECT u.id AS user_id FROM student_parents sp INNER JOIN students s ON s.id = sp.student_id INNER JOIN parents p ON p.id = sp.parent_id INNER JOIN users u ON u.id = p.user_id WHERE s.group_id = $1`,
        [dto.targetGroupId]
      );
      parents.forEach((r) => ids.add(r.user_id));
      return [...ids];
    }
    return [];
  }
}
