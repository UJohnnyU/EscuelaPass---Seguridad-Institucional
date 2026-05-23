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
    const recipients = await this.notificationsRepository.manager.query<
      { user_id: string; student_id: string }[]
    >(
      `SELECT DISTINCT u.id AS user_id, st.id AS student_id
       FROM students st
       INNER JOIN users u ON u.id = st.user_id
       WHERE st.group_id = $1
       UNION
       SELECT DISTINCT u.id AS user_id, sp.student_id
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
    const actId = activity.id;
    const rows = recipients.map((r) => {
      const qs = new URLSearchParams({
        activity: actId,
        studentId: r.student_id
      });
      return this.notificationsRepository.create({
        userId: r.user_id,
        title,
        message,
        deliveryStatus: 'SENT',
        linkPath: `/app/modulos/mis-calificaciones?${qs.toString()}`
      });
    });
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
      const sid = encodeURIComponent(p.student_id);
      return this.notificationsRepository.create({
        userId: p.user_id,
        title,
        message:
          type === ReportCardType.FINAL
            ? `Ya puedes consultar el boletín final del año ${schoolYear}${promotionLabel}.`
            : `Tu boletín del periodo ya está publicado.`,
        deliveryStatus: 'SENT',
        linkPath: `/app/modulos/boletines?studentId=${sid}`
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
