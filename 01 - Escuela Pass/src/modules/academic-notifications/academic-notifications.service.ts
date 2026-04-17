import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityEntity } from '../../database/entities/activity.entity';
import { NotificationEntity } from '../../database/entities/notification.entity';
import {
  PromotionStatus,
  ReportCardEntity,
  ReportCardType
} from '../../database/entities/report-card.entity';
import { FcmService } from '../fcm/fcm.service';

/**
 * Centraliza la creación de notificaciones in-app (tabla `notifications`) + push FCM
 * para eventos académicos: cierre de actividades, publicación de boletines de periodo,
 * publicación de boletines finales.
 */
@Injectable()
export class AcademicNotificationsService {
  private readonly logger = new Logger(AcademicNotificationsService.name);

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationsRepository: Repository<NotificationEntity>,
    private readonly fcmService: FcmService
  ) {}

  async notifyActivityClosed(activity: ActivityEntity): Promise<void> {
    const recipients = await this.notificationsRepository.manager.query<{ user_id: string }[]>(
      `SELECT DISTINCT u.id AS user_id
       FROM students st
       INNER JOIN users u ON u.id = st.user_id
       WHERE st.group_id = $1
       UNION
       SELECT DISTINCT u.id AS user_id
       FROM students st
       INNER JOIN student_parents sp ON sp.student_id = st.id
       INNER JOIN parents p ON p.id = sp.parent_id
       INNER JOIN users u ON u.id = p.user_id
       WHERE st.group_id = $1`,
      [activity.groupId]
    );
    if (recipients.length === 0) return;

    const title = `Nueva calificación publicada`;
    const message = `${activity.subjectName}: ${activity.title} ya tiene calificaciones visibles.`;
    const rows = recipients.map((r) =>
      this.notificationsRepository.create({
        userId: r.user_id,
        title,
        message,
        deliveryStatus: 'SENT'
      })
    );
    const saved = await this.notificationsRepository.save(rows);
    try {
      await this.fcmService.sendPushForNotifications(saved);
    } catch (err) {
      this.logger.warn(`FCM activity closed push failed: ${String(err)}`);
    }
  }

  async notifyReportCardsPublished(
    schoolId: string,
    schoolYear: string,
    type: ReportCardType,
    periodId: string | null
  ): Promise<void> {
    const cards = await this.notificationsRepository.manager
      .getRepository(ReportCardEntity)
      .createQueryBuilder('rc')
      .where('rc.school_id = :sid', { sid: schoolId })
      .andWhere('rc.school_year = :sy', { sy: schoolYear })
      .andWhere('rc.type = :t', { t: type })
      .andWhere(periodId ? 'rc.period_id = :pid' : 'rc.period_id IS NULL', { pid: periodId })
      .getMany();
    if (cards.length === 0) return;

    const studentIds = cards.map((c) => c.studentId);
    const people = await this.notificationsRepository.manager.query<
      { user_id: string; student_id: string }[]
    >(
      `SELECT DISTINCT u.id AS user_id, st.id AS student_id
       FROM students st
       INNER JOIN users u ON u.id = st.user_id
       WHERE st.id = ANY($1::uuid[])
       UNION
       SELECT DISTINCT u.id AS user_id, sp.student_id
       FROM student_parents sp
       INNER JOIN parents p ON p.id = sp.parent_id
       INNER JOIN users u ON u.id = p.user_id
       WHERE sp.student_id = ANY($1::uuid[])`,
      [studentIds]
    );
    if (people.length === 0) return;

    const title = type === ReportCardType.FINAL ? 'Boletín final disponible' : 'Boletín de periodo disponible';
    const rows = people.map((p) => {
      const card = cards.find((c) => c.studentId === p.student_id);
      const promotionLabel = card?.promotionStatus
        ? `: ${this.promotionLabel(card.promotionStatus)}`
        : '';
      return this.notificationsRepository.create({
        userId: p.user_id,
        title,
        message:
          type === ReportCardType.FINAL
            ? `Ya puedes consultar el boletín final del año ${schoolYear}${promotionLabel}.`
            : `Tu boletín del periodo ya está publicado.`,
        deliveryStatus: 'SENT'
      });
    });
    const saved = await this.notificationsRepository.save(rows);
    try {
      await this.fcmService.sendPushForNotifications(saved);
    } catch (err) {
      this.logger.warn(`FCM report cards push failed: ${String(err)}`);
    }
  }

  private promotionLabel(s: PromotionStatus): string {
    switch (s) {
      case PromotionStatus.APROBADO:
        return 'Aprobado';
      case PromotionStatus.APROBADO_CON_PENDIENTES:
        return 'Aprobado con pendientes';
      case PromotionStatus.REPROBADO:
        return 'Reprobado';
      default:
        return 'Sin estado';
    }
  }
}
