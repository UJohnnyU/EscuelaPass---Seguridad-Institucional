import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  MeetingEntity,
  MeetingModality,
  MeetingStatus
} from '../../database/entities/meeting.entity';
import {
  MeetingParticipantEntity,
  MeetingParticipantRsvp
} from '../../database/entities/meeting-participant.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { AudienceResolverService } from '../events-core/audience-resolver.service';
import { EventNotificationsService } from '../events-core/event-notifications.service';
import { CancelMeetingDto } from './dto/cancel-meeting.dto';
import { CreateMeetingDto, MeetingInviteDto } from './dto/create-meeting.dto';
import { MeetingRsvpDto } from './dto/meeting-rsvp.dto';
import { MeetingStatusDto } from './dto/meeting-status.dto';
import { RescheduleMeetingDto } from './dto/reschedule-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';

type ParticipantRow = MeetingParticipantEntity & {
  fullName: string;
  email: string;
  role: UserRole;
};

type MeetingRow = MeetingEntity & {
  participants: ParticipantRow[];
  counts: { pending: number; accepted: number; declined: number };
};

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    @InjectRepository(MeetingEntity)
    private readonly meetingsRepository: Repository<MeetingEntity>,
    @InjectRepository(MeetingParticipantEntity)
    private readonly participantsRepository: Repository<MeetingParticipantEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachersRepository: Repository<TeacherEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly audienceResolver: AudienceResolverService,
    private readonly notifier: EventNotificationsService
  ) {}

  async create(dto: CreateMeetingDto, userId: string, role: UserRole): Promise<MeetingRow> {
    if (role !== UserRole.ADMIN && role !== UserRole.ADMINISTRATIVO && role !== UserRole.DOCENTE) {
      throw new ForbiddenException('Solo staff puede crear reuniones');
    }

    const organizer = await this.usersRepository.findOne({ where: { id: userId } });
    if (!organizer) throw new ForbiddenException('Organizador no encontrado');
    if (!organizer.schoolId) {
      throw new BadRequestException('Organizador sin institución asignada');
    }

    const schoolId = organizer.schoolId;
    const invitees = dto.invitees ?? [];

    if (role === UserRole.DOCENTE) {
      if (dto.presetAllTeachersOfSchool || dto.presetAllAdministrativesOfSchool) {
        throw new ForbiddenException(
          'Un docente no puede invitar a todos los docentes o administrativos de la escuela'
        );
      }
      if (dto.presetAllParentsOfGroupIds && dto.presetAllParentsOfGroupIds.length > 0) {
        await this.assertTeacherOwnsGroups(userId, dto.presetAllParentsOfGroupIds);
      }
    }

    const presetUserIds = await this.audienceResolver.resolveForMeeting({
      schoolId,
      presetAllTeachersOfSchool: dto.presetAllTeachersOfSchool ?? false,
      presetAllAdministrativesOfSchool: dto.presetAllAdministrativesOfSchool ?? false,
      presetAllParentsOfGroupIds: dto.presetAllParentsOfGroupIds ?? []
    });

    const explicitMap = new Map<string, MeetingInviteDto>();
    for (const inv of invitees) {
      explicitMap.set(inv.userId, inv);
    }
    const allUserIds = new Set<string>([...presetUserIds, ...explicitMap.keys()]);
    allUserIds.delete(userId);

    if (allUserIds.size === 0) {
      throw new BadRequestException('La reunión debe tener al menos un invitado');
    }

    const participants = await this.resolveParticipantsMeta(
      [...allUserIds],
      schoolId,
      role
    );

    const meeting = await this.dataSource.transaction(async (em) => {
      const row = em.create(MeetingEntity, {
        schoolId,
        organizerUserId: userId,
        organizerRole: role,
        title: dto.title.trim(),
        purpose: dto.purpose.trim(),
        modality: dto.modality ?? MeetingModality.PRESENCIAL,
        location: dto.location?.trim() ?? null,
        meetingLink: dto.meetingLink?.trim() ?? null,
        startAt: new Date(dto.startAt),
        durationMinutes: dto.durationMinutes ?? 30,
        status: MeetingStatus.PROGRAMADA
      });
      const persisted = await em.save(row);

      await em.save(
        MeetingParticipantEntity,
        participants.map((p) => ({
          meetingId: persisted.id,
          userId: p.id,
          participantRole: p.role,
          studentContextId: explicitMap.get(p.id)?.studentContextId ?? null,
          rsvp: MeetingParticipantRsvp.PENDIENTE
        }))
      );
      return persisted;
    });

    await this.notifier.notifyUsers(
      participants.map((p) => p.id),
      `Nueva reunión: ${meeting.title}`,
      this.buildNotificationBody(meeting),
      { type: 'meeting_invitation', meetingId: meeting.id }
    );
    return this.getDetail(meeting.id, userId, role);
  }

  async listMine(userId: string): Promise<MeetingRow[]> {
    const meetings = await this.meetingsRepository
      .createQueryBuilder('m')
      .where('m.organizer_user_id = :uid', { uid: userId })
      .orWhere(
        `EXISTS (SELECT 1 FROM meeting_participants mp WHERE mp.meeting_id = m.id AND mp.user_id = :uid)`,
        { uid: userId }
      )
      .orderBy('m.start_at', 'DESC')
      .getMany();
    return this.hydrate(meetings);
  }

  async listForStaff(user: { userId: string; role: UserRole }): Promise<MeetingRow[]> {
    if (user.role === UserRole.ADMIN) {
      const rows = await this.meetingsRepository.find({ order: { startAt: 'DESC' } });
      return this.hydrate(rows);
    }
    const userRow = await this.usersRepository.findOne({ where: { id: user.userId } });
    if (!userRow?.schoolId) throw new ForbiddenException('Usuario sin institución');
    const rows = await this.meetingsRepository.find({
      where: { schoolId: userRow.schoolId },
      order: { startAt: 'DESC' }
    });
    return this.hydrate(rows);
  }

  async getDetail(id: string, userId: string, role: UserRole): Promise<MeetingRow> {
    const meeting = await this.meetingsRepository.findOne({ where: { id } });
    if (!meeting) throw new NotFoundException('Reunión no encontrada');
    await this.assertCanView(meeting, userId, role);
    const [row] = await this.hydrate([meeting]);
    return row;
  }

  async update(
    id: string,
    dto: UpdateMeetingDto,
    userId: string,
    role: UserRole
  ): Promise<MeetingRow> {
    const meeting = await this.assertOrganizer(id, userId, role);
    if (meeting.status === MeetingStatus.REALIZADA || meeting.status === MeetingStatus.CANCELADA) {
      throw new BadRequestException('No se puede editar una reunión finalizada o cancelada');
    }
    if (dto.title !== undefined) meeting.title = dto.title.trim();
    if (dto.purpose !== undefined) meeting.purpose = dto.purpose.trim();
    if (dto.modality !== undefined) meeting.modality = dto.modality;
    if (dto.location !== undefined) meeting.location = dto.location.trim() || null;
    if (dto.meetingLink !== undefined) meeting.meetingLink = dto.meetingLink.trim() || null;
    if (dto.durationMinutes !== undefined) meeting.durationMinutes = dto.durationMinutes;
    await this.meetingsRepository.save(meeting);

    const participantIds = await this.loadParticipantUserIds(meeting.id);
    await this.notifier.notifyUsers(
      participantIds,
      `Reunión actualizada: ${meeting.title}`,
      this.buildNotificationBody(meeting),
      { type: 'meeting_updated', meetingId: meeting.id }
    );
    return this.getDetail(meeting.id, userId, role);
  }

  async reschedule(
    id: string,
    dto: RescheduleMeetingDto,
    userId: string,
    role: UserRole
  ): Promise<MeetingRow> {
    const meeting = await this.assertOrganizer(id, userId, role);
    if (meeting.status === MeetingStatus.REALIZADA || meeting.status === MeetingStatus.CANCELADA) {
      throw new BadRequestException('No se puede reprogramar una reunión finalizada o cancelada');
    }
    meeting.previousStartAt = meeting.startAt;
    meeting.startAt = new Date(dto.startAt);
    if (dto.durationMinutes !== undefined) meeting.durationMinutes = dto.durationMinutes;
    meeting.status = MeetingStatus.REPROGRAMADA;
    meeting.reminded24hAt = null;
    meeting.reminded1hAt = null;
    await this.meetingsRepository.save(meeting);

    await this.participantsRepository
      .createQueryBuilder()
      .update()
      .set({ rsvp: MeetingParticipantRsvp.PENDIENTE, respondedAt: null })
      .where('meeting_id = :mid AND rsvp <> :declined', {
        mid: meeting.id,
        declined: MeetingParticipantRsvp.DECLINADA
      })
      .execute();

    const participantIds = await this.loadParticipantUserIds(meeting.id);
    await this.notifier.notifyUsers(
      participantIds,
      `Reunión reprogramada: ${meeting.title}`,
      this.buildNotificationBody(meeting),
      { type: 'meeting_rescheduled', meetingId: meeting.id }
    );
    return this.getDetail(meeting.id, userId, role);
  }

  async cancel(
    id: string,
    dto: CancelMeetingDto,
    userId: string,
    role: UserRole
  ): Promise<MeetingRow> {
    const meeting = await this.assertOrganizer(id, userId, role);
    if (meeting.status === MeetingStatus.REALIZADA) {
      throw new BadRequestException('No se puede cancelar una reunión ya realizada');
    }
    meeting.status = MeetingStatus.CANCELADA;
    meeting.cancellationReason = dto.reason?.trim() ?? null;
    await this.meetingsRepository.save(meeting);

    const participantIds = await this.loadParticipantUserIds(meeting.id);
    await this.notifier.notifyUsers(
      participantIds,
      `Reunión cancelada: ${meeting.title}`,
      dto.reason?.trim() ? `Motivo: ${dto.reason.trim()}` : 'La reunión ha sido cancelada.',
      { type: 'meeting_cancelled', meetingId: meeting.id }
    );
    return this.getDetail(meeting.id, userId, role);
  }

  async changeStatus(
    id: string,
    dto: MeetingStatusDto,
    userId: string,
    role: UserRole
  ): Promise<MeetingRow> {
    const meeting = await this.assertOrganizer(id, userId, role);
    if (meeting.status === MeetingStatus.CANCELADA) {
      throw new BadRequestException('La reunión está cancelada');
    }
    if (dto.action === 'IN_PROGRESS') {
      meeting.status = MeetingStatus.EN_CURSO;
    } else if (dto.action === 'REALIZED') {
      meeting.status = MeetingStatus.REALIZADA;
    }
    await this.meetingsRepository.save(meeting);
    return this.getDetail(meeting.id, userId, role);
  }

  async rsvp(
    id: string,
    dto: MeetingRsvpDto,
    userId: string,
    role: UserRole
  ): Promise<MeetingRow> {
    const meeting = await this.meetingsRepository.findOne({ where: { id } });
    if (!meeting) throw new NotFoundException('Reunión no encontrada');
    const participant = await this.participantsRepository.findOne({
      where: { meetingId: meeting.id, userId }
    });
    if (!participant) throw new ForbiddenException('No eres participante de esta reunión');
    if (
      meeting.status === MeetingStatus.REALIZADA ||
      meeting.status === MeetingStatus.CANCELADA
    ) {
      throw new BadRequestException('La reunión ya no admite cambios de confirmación');
    }
    participant.rsvp = dto.rsvp;
    participant.respondedAt = new Date();
    await this.participantsRepository.save(participant);
    return this.getDetail(meeting.id, userId, role);
  }

  private buildNotificationBody(meeting: MeetingEntity): string {
    const whenIso = meeting.startAt instanceof Date
      ? meeting.startAt.toISOString()
      : new Date(meeting.startAt as unknown as string).toISOString();
    const parts = [
      `Fecha: ${whenIso}`,
      `Modalidad: ${meeting.modality}`
    ];
    if (meeting.modality === MeetingModality.PRESENCIAL && meeting.location) {
      parts.push(`Lugar: ${meeting.location}`);
    }
    if (meeting.modality === MeetingModality.VIRTUAL && meeting.meetingLink) {
      parts.push(`Enlace: ${meeting.meetingLink}`);
    }
    return parts.join(' · ');
  }

  private async resolveParticipantsMeta(
    userIds: string[],
    schoolId: string,
    organizerRole: UserRole
  ): Promise<Array<{ id: string; role: UserRole }>> {
    if (userIds.length === 0) return [];
    const users = await this.usersRepository.find({ where: { id: In(userIds) } });
    if (users.length !== userIds.length) {
      throw new BadRequestException('Algún usuario invitado no existe');
    }
    for (const u of users) {
      if (!u.status) {
        throw new BadRequestException(`Usuario ${u.email} inactivo no puede ser invitado`);
      }
      if (u.schoolId && u.schoolId !== schoolId) {
        throw new BadRequestException(`Usuario ${u.email} pertenece a otra institución`);
      }
      if (organizerRole === UserRole.DOCENTE) {
        const allowed: UserRole[] = [UserRole.PADRE, UserRole.ALUMNO, UserRole.DOCENTE];
        if (!allowed.includes(u.role)) {
          throw new ForbiddenException(
            `Un docente no puede invitar a usuarios con rol ${u.role}`
          );
        }
      }
    }
    return users.map((u) => ({ id: u.id, role: u.role }));
  }

  private async assertTeacherOwnsGroups(userId: string, groupIds: string[]): Promise<void> {
    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');
    const rows = await this.dataSource.query<{ cnt: string }[]>(
      `SELECT COUNT(*)::text AS cnt FROM teacher_groups
       WHERE teacher_id = $1 AND group_id = ANY($2::uuid[])`,
      [teacher.id, groupIds]
    );
    if (Number(rows[0]?.cnt ?? 0) !== groupIds.length) {
      throw new ForbiddenException('El docente no tiene asignación en alguno de los grupos');
    }
  }

  private async assertOrganizer(
    id: string,
    userId: string,
    role: UserRole
  ): Promise<MeetingEntity> {
    const meeting = await this.meetingsRepository.findOne({ where: { id } });
    if (!meeting) throw new NotFoundException('Reunión no encontrada');
    if (role === UserRole.ADMIN) return meeting;
    if (meeting.organizerUserId === userId) return meeting;
    if (role === UserRole.ADMINISTRATIVO) {
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (user?.schoolId === meeting.schoolId) return meeting;
    }
    throw new ForbiddenException('Solo el organizador puede modificar esta reunión');
  }

  private async assertCanView(
    meeting: MeetingEntity,
    userId: string,
    role: UserRole
  ): Promise<void> {
    if (role === UserRole.ADMIN) return;
    if (meeting.organizerUserId === userId) return;
    const participant = await this.participantsRepository.findOne({
      where: { meetingId: meeting.id, userId }
    });
    if (participant) return;
    if (role === UserRole.ADMINISTRATIVO) {
      const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (user?.schoolId === meeting.schoolId) return;
    }
    throw new ForbiddenException('No tienes acceso a esta reunión');
  }

  private async loadParticipantUserIds(meetingId: string): Promise<string[]> {
    const rows = await this.participantsRepository.find({ where: { meetingId } });
    return rows.map((r) => r.userId);
  }

  private async hydrate(meetings: MeetingEntity[]): Promise<MeetingRow[]> {
    if (meetings.length === 0) return [];
    const ids = meetings.map((m) => m.id);
    const participants = await this.participantsRepository.find({
      where: { meetingId: In(ids) }
    });
    const userIds = [...new Set(participants.map((p) => p.userId))];
    const users = userIds.length
      ? await this.usersRepository.find({ where: { id: In(userIds) } })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u] as const));

    const byMeeting = new Map<string, ParticipantRow[]>();
    for (const p of participants) {
      const list = byMeeting.get(p.meetingId) ?? [];
      const user = userMap.get(p.userId);
      list.push({
        ...p,
        fullName: user?.fullName ?? '(usuario)',
        email: user?.email ?? '',
        role: (user?.role ?? (p.participantRole as UserRole))
      } as ParticipantRow);
      byMeeting.set(p.meetingId, list);
    }

    return meetings.map((m) => {
      const list = byMeeting.get(m.id) ?? [];
      const counts = {
        pending: list.filter((x) => x.rsvp === MeetingParticipantRsvp.PENDIENTE).length,
        accepted: list.filter((x) => x.rsvp === MeetingParticipantRsvp.ACEPTADA).length,
        declined: list.filter((x) => x.rsvp === MeetingParticipantRsvp.DECLINADA).length
      };
      return { ...m, participants: list, counts };
    });
  }
}
