import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEntity } from '../../database/entities/notification.entity';
import { FcmService } from '../fcm/fcm.service';

export type EventNotificationType =
  | 'visit_created'
  | 'visit_updated'
  | 'visit_rescheduled'
  | 'visit_cancelled'
  | 'visit_reminder'
  | 'meeting_invitation'
  | 'meeting_updated'
  | 'meeting_rescheduled'
  | 'meeting_cancelled'
  | 'meeting_reminder';

/**
 * Persiste notificaciones in-app (tabla `notifications`) + dispara push FCM
 * para eventos de visitas externas y reuniones internas.
 * Reusa el patrón de `AcademicNotificationsService` y `NoticesService`.
 */
@Injectable()
export class EventNotificationsService {
  private readonly logger = new Logger(EventNotificationsService.name);

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationsRepository: Repository<NotificationEntity>,
    private readonly fcmService: FcmService
  ) {}

  async notifyUsers(
    userIds: string[],
    title: string,
    message: string,
    data: Record<string, string> & { type: EventNotificationType }
  ): Promise<void> {
    const uniques = [...new Set(userIds.filter(Boolean))];
    if (uniques.length === 0) return;

    const rows = uniques.map((userId) =>
      this.notificationsRepository.create({
        userId,
        title,
        message,
        deliveryStatus: 'SENT'
      })
    );
    const saved = await this.notificationsRepository.save(rows);

    try {
      await this.sendPushWithCustomType(saved, data);
    } catch (err) {
      this.logger.warn(`FCM push para ${data.type} falló: ${String(err)}`);
    }
  }

  /**
   * Wrapper sobre FcmService: reusa la lógica de lookup de tokens pero
   * sobrescribe `data.type` con el tipo específico del evento.
   */
  private async sendPushWithCustomType(
    rows: NotificationEntity[],
    data: Record<string, string>
  ): Promise<void> {
    for (const n of rows) {
      const payload: Record<string, string> = {
        ...data,
        notificationId: n.id
      };
      await this.fcmService.sendPushToUser(n.userId, n.title, n.message, payload);
    }
  }
}
