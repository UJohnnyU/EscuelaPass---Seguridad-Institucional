import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, IsNull, Repository } from 'typeorm';
import { AdminReportCommentEntity } from '../../database/entities/admin-report-comment.entity';
import { AdminReportEntity, AdminReportStatus, AdminReportType } from '../../database/entities/admin-report.entity';
import { GroupEntity } from '../../database/entities/group.entity';
import { NoticeEntity, NoticeTargetType } from '../../database/entities/notice.entity';
import { NotificationEntity } from '../../database/entities/notification.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { CreateAdminReportDto } from './dto/create-admin-report.dto';
import { FcmService } from '../fcm/fcm.service';

@Injectable()
export class NoticesService {
  private readonly logger = new Logger(NoticesService.name);

  constructor(
    @InjectRepository(NoticeEntity)
    private readonly noticesRepository: Repository<NoticeEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notificationsRepository: Repository<NotificationEntity>,
    @InjectRepository(AdminReportEntity)
    private readonly adminReportsRepository: Repository<AdminReportEntity>,
    @InjectRepository(AdminReportCommentEntity)
    private readonly adminReportCommentsRepository: Repository<AdminReportCommentEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentsRepository: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachersRepository: Repository<TeacherEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupsRepository: Repository<GroupEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly fcmService: FcmService
  ) {}

  async create(dto: CreateNoticeDto, createdByUserId: string, role: UserRole, schoolIdParam?: string) {
    this.validateTargets(dto);
    const scopeSchoolId = await this.ensureRoleScope(role, createdByUserId, dto, schoolIdParam);
    if (dto.targetType === NoticeTargetType.GROUP && dto.targetGroupId) {
      const exists = await this.groupsRepository.exist({ where: { id: dto.targetGroupId } });
      if (!exists) {
        throw new BadRequestException('Grupo no encontrado');
      }
    }
    if (dto.targetType === NoticeTargetType.USER && dto.targetUserId) {
      const exists = await this.usersRepository.exist({ where: { id: dto.targetUserId } });
      if (!exists) {
        throw new BadRequestException('Usuario destino no encontrado');
      }
    }
    const recipientIds = await this.resolveRecipientUserIds(dto, scopeSchoolId);
    const uniqueIds = [...new Set(recipientIds)];
    const notice = this.noticesRepository.create({
      title: dto.title,
      content: dto.content,
      targetType: dto.targetType,
      targetUserId: dto.targetType === NoticeTargetType.USER ? dto.targetUserId ?? null : null,
      targetGroupId: dto.targetType === NoticeTargetType.GROUP ? dto.targetGroupId ?? null : null,
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
        return {
          data: [],
          meta: { total: 0, page: Math.max(page, 1), limit: take, pages: 0 }
        };
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
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['id', 'role']
    });
    if (!user) {
      throw new ForbiddenException('Usuario no encontrado');
    }
    const qb = this.notificationsRepository
      .createQueryBuilder('n')
      .where('n.user_id = :userId', { userId })
      .orderBy('n.sent_at', 'DESC')
      .skip(skip)
      .take(take);
    if (user.role === UserRole.ADMIN) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('n.title ILIKE :reportTitle', { reportTitle: '[Reporte%' })
            .orWhere('n.title ILIKE :commentTitle', { commentTitle: '[Comentario]%' })
            .orWhere('n.message ILIKE :reportIdTag', { reportIdTag: '%Reporte ID:%' });
        })
      );
    }
    const [items, total] = await qb.getManyAndCount();
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
    if (!parentId) {
      throw new ForbiddenException('Perfil padre no encontrado');
    }

    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const rows = await this.dataSource.query<
      {
        id: string;
        userId: string;
        noticeId: string | null;
        title: string;
        message: string;
        readAt: string | null;
        sentAt: string;
        deliveryStatus: string;
        studentName: string;
      }[]
    >(
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

  /**
   * Grupos en los que el docente tiene asignación (para publicar avisos a un grupo).
   */
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
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      grade: r.grade,
      schoolYear: r.school_year
    }));
  }

  /**
   * Alumnos y padres vinculados a los grupos del docente (destinatarios de aviso individual).
   */
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
    return rows.map((r) => ({
      userId: r.user_id,
      fullName: r.full_name,
      email: r.email ?? '',
      kind: r.kind
    }));
  }

  private async ensureTeacherProfile(userId: string): Promise<TeacherEntity> {
    const existing = await this.teachersRepository.findOne({ where: { userId } });
    if (existing) return existing;
    const placeholder = `SE-${userId.slice(0, 8).toUpperCase()}`;
    const created = this.teachersRepository.create({ userId, employeeNumber: placeholder });
    return this.teachersRepository.save(created);
  }

  async markAsRead(notificationId: string, userId: string) {
    const notif = await this.notificationsRepository.findOne({
      where: { id: notificationId, userId }
    });
    if (!notif) {
      throw new NotFoundException('Notificación no encontrada');
    }
    notif.readAt = new Date();
    await this.notificationsRepository.save(notif);
    return { message: 'Marcada como leída', id: notif.id };
  }

  async createAdminReport(dto: CreateAdminReportDto, senderUserId: string, role: UserRole) {
    const sender = await this.usersRepository.findOne({
      where: { id: senderUserId },
      select: ['id', 'fullName', 'email', 'schoolId', 'role']
    });
    if (!sender) {
      throw new ForbiddenException('Usuario no encontrado');
    }
    if (!sender.schoolId) {
      throw new ForbiddenException('Tu usuario no tiene escuela asignada para enviar reportes.');
    }

    const adminsInSchool = await this.usersRepository.find({
      where: { role: UserRole.ADMIN, status: true, schoolId: sender.schoolId },
      select: ['id']
    });
    let recipientIds = adminsInSchool.map((u) => u.id);
    if (recipientIds.length === 0) {
      const fallbackAdmins = await this.usersRepository.find({
        where: { role: UserRole.ADMIN, status: true },
        select: ['id']
      });
      recipientIds = fallbackAdmins.map((u) => u.id);
    }
    recipientIds = [...new Set(recipientIds)].filter((id) => id !== senderUserId);
    if (recipientIds.length === 0) {
      throw new NotFoundException('No hay cuentas ADMIN disponibles para recibir el reporte');
    }

    const cleanSubject = dto.subject.trim();
    const cleanMessage = dto.message.trim();
    const typeLabelByEnum: Record<AdminReportType, string> = {
      ERROR: 'Error',
      SUGERENCIA: 'Sugerencia',
      PETICION: 'Petición',
      OTRO: 'Otro'
    };
    const typeLabel = typeLabelByEnum[dto.type] ?? dto.type;
    const title = `[Reporte administrativo · ${typeLabel}] ${cleanSubject}`;
    const schoolRow = await this.usersRepository.manager.query<{ name: string | null }[]>(
      `SELECT name FROM schools WHERE id = $1 LIMIT 1`,
      [sender.schoolId]
    );
    const schoolName = schoolRow[0]?.name?.trim() || 'Institución';
    const senderName = sender.fullName?.trim() || sender.email || 'Usuario';
    const roleLabelByEnum: Record<UserRole, string> = {
      ADMIN: 'Admin',
      ADMINISTRATIVO: 'Administrativo',
      DOCENTE: 'Docente',
      PADRE: 'Padre/Tutor',
      ALUMNO: 'Alumno'
    };
    const cleanEvidence = Array.from(
      new Set((dto.evidenceUrls ?? []).map((u) => u.trim()).filter((u) => u.startsWith('/uploads/')))
    ).slice(0, 5);
    const evidenceBlock =
      cleanEvidence.length > 0 ? `\n\nEvidencias:\n${cleanEvidence.map((u, i) => `${i + 1}. ${u}`).join('\n')}` : '';
    const message = [
      `Escuela: ${schoolName}`,
      `Remitente: ${senderName}`,
      `Rol: ${roleLabelByEnum[sender.role] ?? sender.role}`,
      `Tipo: ${typeLabel}`,
      '',
      cleanMessage
    ].join('\n') + evidenceBlock;

    const report = this.adminReportsRepository.create({
      schoolId: sender.schoolId,
      createdByUserId: senderUserId,
      assignedAdminUserId: recipientIds[0] ?? null,
      type: dto.type as unknown as AdminReportType,
      subject: cleanSubject,
      message: cleanMessage + evidenceBlock,
      status: AdminReportStatus.PENDIENTE
    });
    const savedReport = await this.adminReportsRepository.save(report);

    const rows = recipientIds.map((userId) =>
      this.notificationsRepository.create({
        userId,
        noticeId: null,
        title,
        message: `${message}\n\nReporte ID: ${savedReport.id}`,
        deliveryStatus: 'SENT'
      })
    );
    const savedRows = await this.notificationsRepository.save(rows);
    void this.fcmService.sendPushForNotifications(savedRows).catch((err: unknown) => {
      this.logger.warn(`Push FCM de reporte administrativo no enviado: ${String(err)}`);
    });
    return {
      message: 'Reporte enviado al equipo administrador',
      reportId: savedReport.id,
      recipientsCount: recipientIds.length
    };
  }

  async listAdminReports(
    adminUserId: string,
    opts: {
      page: number;
      limit: number;
      type?: string;
      q?: string;
      unreadOnly?: boolean;
      status?: string;
      schoolId?: string;
    }
  ) {
    const admin = await this.usersRepository.findOne({
      where: { id: adminUserId },
      select: ['id', 'schoolId', 'role']
    });
    if (!admin || admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo el equipo administrador puede consultar reportes internos');
    }
    const take = Math.min(Math.max(opts.limit, 1), 100);
    const skip = (Math.max(opts.page, 1) - 1) * take;
    const qb = this.adminReportsRepository.createQueryBuilder('r').orderBy('r.created_at', 'DESC');
    if (admin.schoolId) qb.where('r.school_id = :sid', { sid: admin.schoolId });

    if (opts.type) {
      qb.andWhere('r.type = :type', { type: opts.type });
    }
    if (opts.status) {
      qb.andWhere('r.status = :status', { status: opts.status });
    }
    if (opts.q) {
      qb.andWhere('(r.subject ILIKE :q OR r.message ILIKE :q)', {
        q: `%${opts.q}%`
      });
    }
    if (opts.unreadOnly) {
      qb.andWhere(
        `(SELECT COUNT(*) FROM notifications n
           WHERE n.user_id = :uidUnread
             AND n.message LIKE CONCAT('%Reporte ID: ', r.id::text)
             AND n.read_at IS NULL
         ) > 0`,
        { uidUnread: adminUserId }
      );
    }
    if (opts.schoolId) {
      qb.andWhere('r.school_id = :filterSchoolId', { filterSchoolId: opts.schoolId });
    }

    const [items, total] = await qb.skip(skip).take(take).getManyAndCount();
    const userIds = [...new Set(items.map((r) => r.createdByUserId).concat(items.map((r) => r.assignedAdminUserId ?? '').filter(Boolean)))];
    const users = userIds.length
      ? await this.usersRepository.find({ where: userIds.map((id) => ({ id })), select: ['id', 'fullName', 'email'] })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    const dataWithNames = items.map((r) => ({
      ...r,
      createdByName: userMap.get(r.createdByUserId)?.fullName ?? userMap.get(r.createdByUserId)?.email ?? 'Usuario',
      assignedAdminName:
        (r.assignedAdminUserId && (userMap.get(r.assignedAdminUserId)?.fullName ?? userMap.get(r.assignedAdminUserId)?.email)) || null
    }));
    const data = await this.enrichReportsWithSla(dataWithNames);
    return {
      data,
      meta: { total, page: Math.max(opts.page, 1), limit: take, pages: Math.ceil(total / take) }
    };
  }

  async listMyAdminReports(userId: string, page = 1, limit = 20) {
    const user = await this.usersRepository.findOne({ where: { id: userId }, select: ['id'] });
    if (!user) throw new ForbiddenException('Usuario no encontrado');
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const [rows, total] = await this.adminReportsRepository.findAndCount({
      where: { createdByUserId: userId },
      order: { createdAt: 'DESC' },
      skip,
      take
    });
    const data = await this.enrichReportsWithSla(rows);
    return {
      data,
      meta: { total, page: Math.max(page, 1), limit: take, pages: Math.ceil(total / take) }
    };
  }

  async getAdminReportsSlaSummary(adminUserId: string, schoolId?: string) {
    const admin = await this.usersRepository.findOne({
      where: { id: adminUserId },
      select: ['id', 'schoolId', 'role']
    });
    if (!admin || admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo el equipo administrador puede consultar SLA');
    }
    const qb = this.adminReportsRepository.createQueryBuilder('r').orderBy('r.created_at', 'DESC').take(500);
    if (admin.schoolId) qb.where('r.school_id = :sid', { sid: admin.schoolId });
    if (schoolId?.trim()) qb.andWhere('r.school_id = :sidFilter', { sidFilter: schoolId.trim() });
    const rows = await qb.getMany();
    const enriched = await this.enrichReportsWithSla(rows);
    const pending = enriched.filter((r) => r.status === AdminReportStatus.PENDIENTE).length;
    const inProgress = enriched.filter((r) => r.status === AdminReportStatus.EN_PROCESO).length;
    const resolved = enriched.filter((r) => r.status === AdminReportStatus.RESUELTO).length;
    const responseBreached = enriched.filter((r) => r.slaResponseStatus === 'BREACHED').length;
    const resolutionBreached = enriched.filter((r) => r.slaResolutionStatus === 'BREACHED').length;
    const responseHours = enriched.map((r) => r.slaResponseHours).filter((n): n is number => typeof n === 'number');
    const resolutionHours = enriched.map((r) => r.slaResolutionHours).filter((n): n is number => typeof n === 'number');
    const avg = (values: number[]) =>
      values.length > 0 ? Number((values.reduce((acc, v) => acc + v, 0) / values.length).toFixed(1)) : null;
    return {
      total: enriched.length,
      pending,
      inProgress,
      resolved,
      responseBreached,
      resolutionBreached,
      avgResponseHours: avg(responseHours),
      avgResolutionHours: avg(resolutionHours),
      responseSlaHours: 24,
      resolutionSlaHours: 72
    };
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
      (acc, row) => ({
        totalRecipients: acc.totalRecipients + row.totalRecipients,
        read: acc.read + row.readCount,
        unread: acc.unread + row.unreadCount
      }),
      { totalRecipients: 0, read: 0, unread: 0 }
    );
    return {
      data,
      meta: { total, page, limit: take, pages: Math.ceil(total / take) },
      summary
    };
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
      const users = await this.usersRepository.find({
        where: { schoolId: opts.schoolId.trim() },
        select: ['id']
      });
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

  async updateAdminReportStatus(id: string, adminUserId: string, status: AdminReportStatus, role: UserRole) {
    if (role !== UserRole.ADMIN) throw new ForbiddenException('Solo ADMIN puede actualizar el estado');
    const report = await this.adminReportsRepository.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Reporte no encontrado');
    const adminUser = await this.usersRepository.findOne({ where: { id: adminUserId }, select: ['schoolId'] });
    if (adminUser?.schoolId && report.schoolId !== adminUser.schoolId) {
      throw new ForbiddenException('Reporte fuera de su institución');
    }
    report.status = status;
    report.assignedAdminUserId = adminUserId;
    if (status === AdminReportStatus.RESUELTO) {
      report.resolvedAt = new Date();
      report.resolvedByUserId = adminUserId;
    } else {
      report.resolvedAt = null;
      report.resolvedByUserId = null;
    }
    const saved = await this.adminReportsRepository.save(report);
    const statusNotif = await this.notificationsRepository.save(
      this.notificationsRepository.create({
        userId: report.createdByUserId,
        noticeId: null,
        title: `[Reporte ${report.subject}] actualizado`,
        message: `El reporte fue actualizado a estado: ${status}`,
        deliveryStatus: 'SENT'
      })
    );
    void this.fcmService.sendPushForNotifications([statusNotif]).catch((err: unknown) => {
      this.logger.warn(`Push FCM (estado reporte) no enviado: ${String(err)}`);
    });
    return saved;
  }

  private async enrichReportsWithSla<T extends AdminReportEntity>(rows: T[]) {
    if (rows.length === 0) return rows as Array<T & Record<string, unknown>>;
    const reportIds = rows.map((r) => r.id);
    const firstAdminComments = await this.adminReportCommentsRepository
      .createQueryBuilder('c')
      .innerJoin(UserEntity, 'u', 'u.id = c.user_id')
      .select('c.reportId', 'reportId')
      .addSelect('MIN(c.created_at)', 'firstAdminCommentAt')
      .where('c.report_id IN (:...ids)', { ids: reportIds })
      .andWhere('u.role = :role', { role: UserRole.ADMIN })
      .groupBy('c.report_id')
      .getRawMany<{ reportId: string; firstAdminCommentAt: string | null }>();
    const firstCommentMap = new Map(firstAdminComments.map((r) => [r.reportId, r.firstAdminCommentAt]));
    const nowMs = Date.now();
    const responseSlaMs = 24 * 60 * 60 * 1000;
    const resolutionSlaMs = 72 * 60 * 60 * 1000;
    return rows.map((r) => {
      const createdMs = new Date(r.createdAt).getTime();
      const resolvedMs = r.resolvedAt ? new Date(r.resolvedAt).getTime() : null;
      const firstCommentAt = firstCommentMap.get(r.id);
      const firstResponseMs =
        firstCommentAt != null
          ? new Date(firstCommentAt).getTime()
          : r.status !== AdminReportStatus.PENDIENTE
            ? new Date(r.updatedAt).getTime()
            : null;
      const responseRefMs = firstResponseMs ?? nowMs;
      const resolutionRefMs = resolvedMs ?? nowMs;
      const responseElapsedMs = Math.max(0, responseRefMs - createdMs);
      const resolutionElapsedMs = Math.max(0, resolutionRefMs - createdMs);
      const slaResponseStatus =
        firstResponseMs == null
          ? responseElapsedMs > responseSlaMs
            ? 'BREACHED'
            : 'PENDING'
          : responseElapsedMs > responseSlaMs
            ? 'BREACHED'
            : 'OK';
      const slaResolutionStatus =
        r.status === AdminReportStatus.RESUELTO
          ? resolutionElapsedMs > resolutionSlaMs
            ? 'BREACHED'
            : 'OK'
          : resolutionElapsedMs > resolutionSlaMs
            ? 'BREACHED'
            : 'PENDING';
      return {
        ...r,
        firstResponseAt: firstResponseMs ? new Date(firstResponseMs).toISOString() : null,
        slaResponseHours: Number((responseElapsedMs / (1000 * 60 * 60)).toFixed(1)),
        slaResolutionHours: Number((resolutionElapsedMs / (1000 * 60 * 60)).toFixed(1)),
        slaResponseStatus,
        slaResolutionStatus
      };
    });
  }

  async listAdminReportComments(reportId: string, userId: string, role: UserRole) {
    await this.assertCanAccessAdminReport(reportId, userId, role);
    const comments = await this.adminReportCommentsRepository.find({
      where: { reportId },
      order: { createdAt: 'ASC' }
    });
    const users = comments.length
      ? await this.usersRepository.find({
          where: [...new Set(comments.map((c) => c.userId))].map((id) => ({ id })),
          select: ['id', 'fullName', 'email', 'role']
        })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    return comments.map((c) => ({
      ...c,
      authorName: byId.get(c.userId)?.fullName ?? byId.get(c.userId)?.email ?? 'Usuario',
      authorRole: byId.get(c.userId)?.role ?? null
    }));
  }

  async addAdminReportComment(reportId: string, userId: string, role: UserRole, message: string) {
    const report = await this.assertCanAccessAdminReport(reportId, userId, role);
    const row = this.adminReportCommentsRepository.create({
      reportId,
      userId,
      message: message.trim()
    });
    const saved = await this.adminReportCommentsRepository.save(row);
    const notifyTo = role === UserRole.ADMIN ? report.createdByUserId : report.assignedAdminUserId;
    if (notifyTo) {
      const commentNotif = await this.notificationsRepository.save(
        this.notificationsRepository.create({
          userId: notifyTo,
          noticeId: null,
          title: `[Comentario] ${report.subject}`,
          message: message.trim(),
          deliveryStatus: 'SENT'
        })
      );
      void this.fcmService.sendPushForNotifications([commentNotif]).catch((err: unknown) => {
        this.logger.warn(`Push FCM (comentario reporte) no enviado: ${String(err)}`);
      });
    }
    return saved;
  }

  private async assertCanAccessAdminReport(reportId: string, userId: string, role: UserRole): Promise<AdminReportEntity> {
    const report = await this.adminReportsRepository.findOne({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Reporte no encontrado');
    if (role === UserRole.ADMIN) {
      const admin = await this.usersRepository.findOne({ where: { id: userId }, select: ['schoolId'] });
      if (admin?.schoolId && admin.schoolId !== report.schoolId) {
        throw new ForbiddenException('Reporte fuera de su institución');
      }
      return report;
    }
    if (report.createdByUserId === userId) {
      return report;
    }
    throw new ForbiddenException('No autorizado para ver este reporte');
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
      if (!schoolRows[0]?.id) {
        throw new BadRequestException('Institución no encontrada');
      }
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
          `SELECT EXISTS (
            SELECT 1 FROM teacher_groups WHERE teacher_id = $1 AND group_id = $2
          ) AS exists`,
          [teacher.id, dto.targetGroupId]
        );
        if (!rows[0]?.exists) {
          throw new ForbiddenException('No tienes asignación en ese grupo');
        }
      }
      if (dto.targetType === NoticeTargetType.USER && dto.targetUserId) {
        const rows = await this.dataSource.query<{ ok: boolean }[]>(
          `SELECT EXISTS (
            SELECT 1 FROM users target
            WHERE target.id = $1
              AND (
                EXISTS (
                  SELECT 1 FROM students s
                  INNER JOIN teacher_groups tg ON tg.group_id = s.group_id
                  WHERE s.user_id = target.id AND tg.teacher_id = $2
                )
                OR EXISTS (
                  SELECT 1 FROM student_parents sp
                  INNER JOIN students s ON s.id = sp.student_id
                  INNER JOIN teacher_groups tg ON tg.group_id = s.group_id
                  INNER JOIN parents p ON p.id = sp.parent_id
                  WHERE p.user_id = target.id AND tg.teacher_id = $2
                )
              )
          ) AS ok`,
          [dto.targetUserId, teacher.id]
        );
        if (!rows[0]?.ok) {
          throw new ForbiddenException('Usuario destino fuera de tus grupos asignados');
        }
      }
    }
    return null;
  }

  private async resolveRecipientUserIds(dto: CreateNoticeDto, scopeSchoolId?: string | null): Promise<string[]> {
    if (dto.targetType === NoticeTargetType.ALL) {
      const qb = this.usersRepository.createQueryBuilder('u').select(['u.id']).where('u.status = :st', { st: true });
      if (dto.targetRole) {
        qb.andWhere('u.role = :role', { role: dto.targetRole });
      }
      if (scopeSchoolId) {
        qb.andWhere('u.school_id = :sid', { sid: scopeSchoolId });
      }
      const users = await qb.getMany();
      return users.map((u) => u.id);
    }
    if (dto.targetType === NoticeTargetType.USER && dto.targetUserId) {
      return [dto.targetUserId];
    }
    if (dto.targetType === NoticeTargetType.GROUP && dto.targetGroupId) {
      const ids = new Set<string>();
      const students = await this.studentsRepository.find({
        where: { groupId: dto.targetGroupId },
        select: ['userId']
      });
      students.forEach((s) => ids.add(s.userId));
      const teachers = await this.dataSource.query<{ user_id: string }[]>(
        `SELECT t.user_id FROM teacher_groups tg
         INNER JOIN teachers t ON t.id = tg.teacher_id
         WHERE tg.group_id = $1`,
        [dto.targetGroupId]
      );
      teachers.forEach((r) => ids.add(r.user_id));
      const parents = await this.dataSource.query<{ user_id: string }[]>(
        `SELECT u.id AS user_id
         FROM student_parents sp
         INNER JOIN students s ON s.id = sp.student_id
         INNER JOIN parents p ON p.id = sp.parent_id
         INNER JOIN users u ON u.id = p.user_id
         WHERE s.group_id = $1`,
        [dto.targetGroupId]
      );
      parents.forEach((r) => ids.add(r.user_id));
      return [...ids];
    }
    return [];
  }
}
