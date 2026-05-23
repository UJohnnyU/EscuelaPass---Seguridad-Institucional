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
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Repository } from 'typeorm';
import { getAppTimeZone } from '../../common/local-date';
import {
  ExternalVisitAudienceScope,
  ExternalVisitEntity,
  ExternalVisitStatus
} from '../../database/entities/external-visit.entity';
import { ExternalVisitGroupEntity } from '../../database/entities/external-visit-group.entity';
import { ExternalVisitStudentEntity } from '../../database/entities/external-visit-student.entity';
import {
  MeetingEntity,
  MeetingStatus
} from '../../database/entities/meeting.entity';
import {
  MeetingParticipantEntity,
  MeetingParticipantRsvp
} from '../../database/entities/meeting-participant.entity';
import { AudienceResolverService } from '../events-core/audience-resolver.service';
import { EventNotificationsService } from '../events-core/event-notifications.service';

/**
 * Cron:
 *  - Cada 15 min: detecta eventos a 24h y 1h y envía recordatorios push+in-app.
 *    Para reuniones excluye participantes con rsvp = DECLINADA.
 *  - Diario 00:05 (APP_TIMEZONE): marca como REALIZADA eventos PROGRAMADA/REPROGRAMADA/EN_CURSO
 *    cuya fecha + duración ya pasó.
 */
@Injectable()
export class EventRemindersScheduler {
  private readonly logger = new Logger(EventRemindersScheduler.name);

  constructor(
    @InjectRepository(ExternalVisitEntity)
    private readonly visitsRepository: Repository<ExternalVisitEntity>,
    @InjectRepository(ExternalVisitGroupEntity)
    private readonly visitGroupsRepository: Repository<ExternalVisitGroupEntity>,
    @InjectRepository(ExternalVisitStudentEntity)
    private readonly visitStudentsRepository: Repository<ExternalVisitStudentEntity>,
    @InjectRepository(MeetingEntity)
    private readonly meetingsRepository: Repository<MeetingEntity>,
    @InjectRepository(MeetingParticipantEntity)
    private readonly participantsRepository: Repository<MeetingParticipantEntity>,
    private readonly audienceResolver: AudienceResolverService,
    private readonly notifier: EventNotificationsService
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES, { timeZone: getAppTimeZone() })
  async runReminders(): Promise<void> {
    try {
      await this.sendVisitReminders(24);
      await this.sendVisitReminders(1);
      await this.sendMeetingReminders(24);
      await this.sendMeetingReminders(1);
    } catch (err) {
      this.logger.error('Error en recordatorios de eventos', err as Error);
    }
  }

  @Cron('5 0 * * *', { timeZone: getAppTimeZone() })
  async autoFinalize(): Promise<void> {
    try {
      await this.autoFinalizeVisits();
      await this.autoFinalizeMeetings();
    } catch (err) {
      this.logger.error('Error auto-finalizando eventos', err as Error);
    }
  }

  private async sendVisitReminders(hours: 24 | 1): Promise<void> {
    const now = new Date();
    const from = new Date(now.getTime() + (hours === 24 ? 23.5 : 0.5) * 60 * 60 * 1000);
    const to = new Date(now.getTime() + (hours === 24 ? 24.5 : 1.5) * 60 * 60 * 1000);
    const flagField = hours === 24 ? 'reminded24hAt' : 'reminded1hAt';
    const visits = await this.visitsRepository.find({
      where: [
        {
          visitDatetime: MoreThan(from),
          status: ExternalVisitStatus.PROGRAMADA,
          [flagField]: undefined
        } as Record<string, unknown>
      ]
    });
    const pending = visits.filter((v) => {
      const when = v.visitDatetime instanceof Date ? v.visitDatetime : new Date(v.visitDatetime);
      const flagValue = hours === 24 ? v.reminded24hAt : v.reminded1hAt;
      return (
        when >= from &&
        when <= to &&
        (v.status === ExternalVisitStatus.PROGRAMADA ||
          v.status === ExternalVisitStatus.REPROGRAMADA) &&
        flagValue == null
      );
    });

    for (const v of pending) {
      const [groupIds, studentIds] = await Promise.all([
        v.audienceScope === ExternalVisitAudienceScope.GROUPS
          ? this.visitGroupsRepository.find({ where: { visitId: v.id } }).then((r) => r.map((x) => x.groupId))
          : Promise.resolve<string[]>([]),
        v.audienceScope === ExternalVisitAudienceScope.STUDENTS
          ? this.visitStudentsRepository.find({ where: { visitId: v.id } }).then((r) => r.map((x) => x.studentId))
          : Promise.resolve<string[]>([])
      ]);
      const userIds = await this.audienceResolver.resolveForVisit({
        scope: v.audienceScope,
        schoolId: v.schoolId,
        groupIds,
        studentIds
      });
      const whenIso =
        v.visitDatetime instanceof Date ? v.visitDatetime.toISOString() : new Date(v.visitDatetime).toISOString();
      await this.notifier.notifyUsers(
        userIds,
        `Recordatorio (${hours}h): visita "${v.title}"`,
        `Fecha: ${whenIso} · Visitante: ${v.visitorName}` + (v.location ? ` · Lugar: ${v.location}` : ''),
        { type: 'visit_reminder', visitId: v.id, window: String(hours) }
      );
      if (hours === 24) v.reminded24hAt = new Date();
      else v.reminded1hAt = new Date();
      await this.visitsRepository.save(v);
    }
  }

  private async sendMeetingReminders(hours: 24 | 1): Promise<void> {
    const now = new Date();
    const from = new Date(now.getTime() + (hours === 24 ? 23.5 : 0.5) * 60 * 60 * 1000);
    const to = new Date(now.getTime() + (hours === 24 ? 24.5 : 1.5) * 60 * 60 * 1000);
    const meetings = await this.meetingsRepository.find();
    const pending = meetings.filter((m) => {
      const when = m.startAt instanceof Date ? m.startAt : new Date(m.startAt);
      const flagValue = hours === 24 ? m.reminded24hAt : m.reminded1hAt;
      return (
        when >= from &&
        when <= to &&
        (m.status === MeetingStatus.PROGRAMADA || m.status === MeetingStatus.REPROGRAMADA) &&
        flagValue == null
      );
    });

    for (const m of pending) {
      const participants = await this.participantsRepository.find({ where: { meetingId: m.id } });
      const userIds = participants
        .filter((p) => p.rsvp !== MeetingParticipantRsvp.DECLINADA)
        .map((p) => p.userId);
      const whenIso = m.startAt instanceof Date ? m.startAt.toISOString() : new Date(m.startAt).toISOString();
      await this.notifier.notifyUsers(
        userIds,
        `Recordatorio (${hours}h): reunión "${m.title}"`,
        `Fecha: ${whenIso} · Modalidad: ${m.modality}` +
          (m.location ? ` · Lugar: ${m.location}` : '') +
          (m.meetingLink ? ` · Enlace: ${m.meetingLink}` : ''),
        { type: 'meeting_reminder', meetingId: m.id, window: String(hours) }
      );
      if (hours === 24) m.reminded24hAt = new Date();
      else m.reminded1hAt = new Date();
      await this.meetingsRepository.save(m);
    }
  }

  private async autoFinalizeVisits(): Promise<void> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 1000 * 60 * 10);
    const visits = await this.visitsRepository.find({
      where: [
        { status: ExternalVisitStatus.PROGRAMADA, visitDatetime: LessThan(cutoff) },
        { status: ExternalVisitStatus.REPROGRAMADA, visitDatetime: LessThan(cutoff) }
      ]
    });
    for (const v of visits) {
      const when = v.visitDatetime instanceof Date ? v.visitDatetime : new Date(v.visitDatetime);
      const end = new Date(when.getTime() + (v.durationMinutes ?? 60) * 60 * 1000);
      if (end < now) {
        v.status = ExternalVisitStatus.REALIZADA;
        v.autoFinalizedAt = new Date();
        await this.visitsRepository.save(v);
      }
    }
  }

  private async autoFinalizeMeetings(): Promise<void> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 1000 * 60 * 10);
    const meetings = await this.meetingsRepository.find({
      where: [
        { status: MeetingStatus.PROGRAMADA, startAt: LessThan(cutoff) },
        { status: MeetingStatus.REPROGRAMADA, startAt: LessThan(cutoff) },
        { status: MeetingStatus.EN_CURSO, startAt: LessThan(cutoff) }
      ]
    });
    for (const m of meetings) {
      const when = m.startAt instanceof Date ? m.startAt : new Date(m.startAt);
      const end = new Date(when.getTime() + (m.durationMinutes ?? 30) * 60 * 1000);
      if (end < now) {
        m.status = MeetingStatus.REALIZADA;
        m.autoFinalizedAt = new Date();
        await this.meetingsRepository.save(m);
        await this.participantsRepository
          .createQueryBuilder()
          .update()
          .set({ rsvp: MeetingParticipantRsvp.NO_ASISTIO, respondedAt: new Date() })
          .where('meeting_id = :mid AND rsvp = :pending', {
            mid: m.id,
            pending: MeetingParticipantRsvp.PENDIENTE
          })
          .execute();
      }
    }
  }
}
