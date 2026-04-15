import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { GroupEntity } from '../../database/entities/group.entity';
import { NoticeEntity, NoticeTargetType } from '../../database/entities/notice.entity';
import { NotificationEntity } from '../../database/entities/notification.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { FcmService } from '../fcm/fcm.service';

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
      const teacher = await this.teachersRepository.findOne({ where: { userId } });
      if (!teacher) {
        throw new ForbiddenException('Perfil docente no encontrado');
      }
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
