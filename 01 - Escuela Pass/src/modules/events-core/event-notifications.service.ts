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

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEntity } from '../../database/entities/notification.entity';
import { FcmService } from '../fcm/fcm.service';
import { MailService } from '../mail/mail.service';

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
    private readonly fcmService: FcmService,
    private readonly mailService: MailService
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

    const base = (process.env.FRONTEND_URL ?? '').replace(/\/$/, '') || 'http://localhost:5173';
    const mailItems = saved.map((n) => ({
      userId: n.userId,
      html: this.mailService.wrapNotice(
        title,
        message,
        `${base}/app/modulos/comunicacion?notification=${encodeURIComponent(n.id)}`
      )
    }));
    void this.mailService
      .sendHtmlPerUser(mailItems, title, data.type)
      .catch((err: unknown) => this.logger.warn(`Correo no enviado: ${String(err)}`));
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
