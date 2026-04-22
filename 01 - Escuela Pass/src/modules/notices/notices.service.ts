import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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

  async create(dto: CreateNoticeDto, createdByUserId: string, role: UserRole) {
    this.validateTargets(dto);
    const scopeSchoolId = await this.ensureRoleScope(role, createdByUserId, dto);
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

  async list(page = 1, limit = 20, createdByUserId: string, role: UserRole) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const qb = this.noticesRepository.createQueryBuilder('n').orderBy('n.createdAt', 'DESC');
    if (role === UserRole.DOCENTE && createdByUserId) {
      qb.andWhere('n.created_by = :uid', { uid: createdByUserId });
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
    const [items, total] = await this.notificationsRepository.findAndCount({
      where: { userId },
      order: { sentAt: 'DESC' },
      skip,
      take
    });
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
    if (role !== UserRole.ADMINISTRATIVO) {
      throw new ForbiddenException('Solo personal administrativo puede enviar reportes al equipo administrador');
    }
    const sender = await this.usersRepository.findOne({
      where: { id: senderUserId },
      select: ['id', 'fullName', 'email', 'schoolId', 'role']
    });
    if (!sender?.schoolId) {
      throw new ForbiddenException('Tu usuario administrativo no tiene escuela asignada');
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
    const senderName = sender.fullName?.trim() || sender.email || 'Usuario administrativo';
    const message = [
      `Escuela: ${schoolName}`,
      `Remitente: ${senderName}`,
      `Tipo: ${typeLabel}`,
      '',
      cleanMessage
    ].join('\n');

    const report = this.adminReportsRepository.create({
      schoolId: sender.schoolId,
      createdByUserId: senderUserId,
      assignedAdminUserId: recipientIds[0] ?? null,
      type: dto.type as unknown as AdminReportType,
      subject: cleanSubject,
      message: cleanMessage,
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

    const [items, total] = await qb.skip(skip).take(take).getManyAndCount();
    const userIds = [...new Set(items.map((r) => r.createdByUserId).concat(items.map((r) => r.assignedAdminUserId ?? '').filter(Boolean)))];
    const users = userIds.length
      ? await this.usersRepository.find({ where: userIds.map((id) => ({ id })), select: ['id', 'fullName', 'email'] })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    const data = items.map((r) => ({
      ...r,
      createdByName: userMap.get(r.createdByUserId)?.fullName ?? userMap.get(r.createdByUserId)?.email ?? 'Usuario',
      assignedAdminName:
        (r.assignedAdminUserId && (userMap.get(r.assignedAdminUserId)?.fullName ?? userMap.get(r.assignedAdminUserId)?.email)) || null
    }));
    return {
      data,
      meta: { total, page: Math.max(opts.page, 1), limit: take, pages: Math.ceil(total / take) }
    };
  }

  async listMyAdminReports(userId: string, page = 1, limit = 20) {
    const user = await this.usersRepository.findOne({ where: { id: userId }, select: ['id', 'role', 'schoolId'] });
    if (!user || user.role !== UserRole.ADMINISTRATIVO) {
      throw new ForbiddenException('Solo personal administrativo puede consultar sus reportes');
    }
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const [data, total] = await this.adminReportsRepository.findAndCount({
      where: { createdByUserId: userId },
      order: { createdAt: 'DESC' },
      skip,
      take
    });
    return {
      data,
      meta: { total, page: Math.max(page, 1), limit: take, pages: Math.ceil(total / take) }
    };
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
    await this.notificationsRepository.save(
      this.notificationsRepository.create({
        userId: report.createdByUserId,
        noticeId: null,
        title: `[Reporte ${report.subject}] actualizado`,
        message: `El reporte fue actualizado a estado: ${status}`,
        deliveryStatus: 'SENT'
      })
    );
    return saved;
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
      await this.notificationsRepository.save(
        this.notificationsRepository.create({
          userId: notifyTo,
          noticeId: null,
          title: `[Comentario] ${report.subject}`,
          message: message.trim(),
          deliveryStatus: 'SENT'
        })
      );
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
    if (role === UserRole.ADMINISTRATIVO && report.createdByUserId === userId) {
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

  private async ensureRoleScope(role: UserRole, userId: string, dto: CreateNoticeDto): Promise<string | null> {
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
