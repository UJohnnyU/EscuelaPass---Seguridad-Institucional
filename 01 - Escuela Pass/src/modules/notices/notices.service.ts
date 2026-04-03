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
    await this.ensureRoleScope(role, createdByUserId, dto);
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
    const recipientIds = await this.resolveRecipientUserIds(dto);
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
    const qb = this.noticesRepository.createQueryBuilder('n').orderBy('n.created_at', 'DESC');
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
    }
    if (dto.targetType === NoticeTargetType.USER && !dto.targetUserId) {
      throw new BadRequestException('targetUserId es obligatorio para USER');
    }
    if (dto.targetType === NoticeTargetType.GROUP && !dto.targetGroupId) {
      throw new BadRequestException('targetGroupId es obligatorio para GROUP');
    }
  }

  private async ensureRoleScope(role: UserRole, userId: string, dto: CreateNoticeDto) {
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
  }

  private async resolveRecipientUserIds(dto: CreateNoticeDto): Promise<string[]> {
    if (dto.targetType === NoticeTargetType.ALL) {
      const users = await this.usersRepository.find({
        where: { status: true },
        select: ['id']
      });
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
