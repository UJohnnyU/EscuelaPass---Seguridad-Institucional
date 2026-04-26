import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, LessThanOrEqual, Repository, SelectQueryBuilder } from 'typeorm';
import { FcmService } from '../fcm/fcm.service';
import { ClassSessionEntity } from '../../database/entities/class-session.entity';
import { GroupEntity } from '../../database/entities/group.entity';
import { NotificationEntity } from '../../database/entities/notification.entity';
import { SubjectEntity } from '../../database/entities/subject.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity, TeacherLifecycleStatus } from '../../database/entities/teacher.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { AcademicPeriodEntity, AcademicPeriodStatus } from '../../database/entities/academic-period.entity';
import { CreateScheduleSlotDto } from './dto/create-schedule-slot.dto';
import { UpdateScheduleSlotDto } from './dto/update-schedule-slot.dto';

@Injectable()
export class SchedulesService {
  private readonly logger = new Logger(SchedulesService.name);

  constructor(
    @InjectRepository(ClassSessionEntity)
    private readonly classSessionsRepository: Repository<ClassSessionEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupsRepository: Repository<GroupEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notificationsRepository: Repository<NotificationEntity>,
    @InjectRepository(AcademicPeriodEntity)
    private readonly periodsRepository: Repository<AcademicPeriodEntity>,
    @InjectRepository(SubjectEntity)
    private readonly subjectsRepository: Repository<SubjectEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentsRepository: Repository<StudentEntity>,
    @InjectRepository(ParentEntity)
    private readonly parentsRepository: Repository<ParentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachersRepository: Repository<TeacherEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly fcmService: FcmService
  ) {}

  async create(userId: string, role: UserRole, dto: CreateScheduleSlotDto) {
    const group = await this.groupsRepository.findOne({ where: { id: dto.groupId } });
    if (!group) throw new NotFoundException('Grupo no encontrado');
    await this.assertCanManageGroupSchedule(userId, role, group.id, group.schoolId);

    this.assertEndAfterStart(dto.startTime, dto.endTime);
    const subjectId = dto.subjectId ?? null;
    const teacherId = dto.teacherId ?? null;
    if (!subjectId || !teacherId) {
      throw new BadRequestException('Debe indicar asignatura y docente para crear la sesion');
    }
    await this.assertSubjectTeacherInsideSchool(group.schoolId, subjectId, teacherId);
    const period = await this.resolvePeriodForGroup(group.schoolId, group.schoolYear);
    const startTime = this.normalizePgTime(dto.startTime);
    const endTime = this.normalizePgTime(dto.endTime);
    await this.assertNoSessionOverlap({
      schoolId: group.schoolId,
      periodId: period.id,
      weekday: dto.weekday,
      startTime,
      endTime,
      groupId: group.id,
      teacherId,
      room: dto.room?.trim() || null
    });

    const row = this.classSessionsRepository.create({
      schoolId: group.schoolId,
      academicPeriodId: period.id,
      groupId: dto.groupId,
      weekday: dto.weekday,
      startTime,
      endTime,
      subjectId,
      teacherId,
      room: dto.room?.trim() || null,
      isActive: true,
      createdByUserId: userId,
      updatedByUserId: userId
    });
    const saved = await this.classSessionsRepository.save(row);
    await this.notifySessionMutation('CREATED', {
      actorUserId: userId,
      current: saved
    });
    return saved;
  }

  async listByGroup(groupId: string, userId: string, role: UserRole) {
    const group = await this.groupsRepository.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Grupo no encontrado');

    await this.assertCanViewGroupSchedule(userId, role, groupId);

    return this.listEffectiveSlotsByGroup(groupId);
  }

  /** Todas las franjas horarias donde figura el docente (cualquier grupo). */
  /** Horario del grupo del estudiante (franjas semanales). */
  async listMySlotsAsStudent(userId: string, refDateRaw?: string, weekFromRaw?: string) {
    const weekEnd = this.parseRefDate(refDateRaw);
    let weekStart = this.parseRefDate(weekFromRaw);
    if (!weekStart && weekEnd) {
      weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);
    }
    const student = await this.studentsRepository.findOne({ where: { userId } });
    if (!student) throw new ForbiddenException('Perfil de estudiante no encontrado');
    if (!student.groupId) {
      return {
        groupId: null as string | null,
        group: null as { id: string; name: string; grade: string | null; schoolYear: string } | null,
        slots: [] as Array<ClassSessionEntity & { subjectName: string | null }>
      };
    }
    const group = await this.groupsRepository.findOne({ where: { id: student.groupId } });
    const schoolId = group?.schoolId ?? student.schoolId;
    const capYmd = await this.fetchScheduleCapYmdForSchool(schoolId);
    const weekStartYmd = weekStart ? this.toYmdLocal(weekStart) : null;
    if (capYmd && weekStartYmd && weekStartYmd > capYmd) {
      return {
        groupId: student.groupId,
        group: group
          ? {
              id: group.id,
              name: group.name,
              grade: group.grade,
              schoolYear: group.schoolYear
            }
          : null,
        slots: [] as Array<ClassSessionEntity & { subjectName: string | null }>
      };
    }
    const asOfDate = this.resolveScheduleAsOfDate(weekEnd, capYmd);
    const slots = await this.listEffectiveSlotsByGroup(student.groupId, asOfDate ?? undefined);
    const sids = [...new Set(slots.map((s) => s.subjectId).filter((x): x is string => !!x))];
    const subjects =
      sids.length > 0 ? await this.subjectsRepository.find({ where: { id: In(sids) } }) : [];
    const nameById = Object.fromEntries(subjects.map((s) => [s.id, s.name]));
    return {
      groupId: student.groupId,
      group: group
        ? {
            id: group.id,
            name: group.name,
            grade: group.grade,
            schoolYear: group.schoolYear
          }
        : null,
      slots: slots.map((s) => ({
        ...s,
        subjectName: s.subjectId ? nameById[s.subjectId] ?? null : null
      }))
    };
  }

  async listMyChildrenSlotsAsParent(
    userId: string,
    opts?: { weekFrom?: string; weekTo?: string }
  ) {
    const parent = await this.parentsRepository.findOne({ where: { userId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');

    const weekTo = this.parseRefDate(opts?.weekTo?.trim()) ?? new Date();
    let weekFrom = this.parseRefDate(opts?.weekFrom?.trim());
    if (!weekFrom) {
      weekFrom = new Date(weekTo);
      weekFrom.setDate(weekFrom.getDate() - 6);
    }

    const children = await this.studentsRepository.manager.query<
      {
        studentId: string;
        studentName: string;
        groupId: string | null;
        groupName: string | null;
        grade: string | null;
        schoolYear: string | null;
        groupSchoolId: string | null;
      }[]
    >(
      `SELECT s.id AS "studentId",
              u.full_name AS "studentName",
              s.group_id AS "groupId",
              g.name AS "groupName",
              g.grade AS "grade",
              g.school_year AS "schoolYear",
              g.school_id AS "groupSchoolId"
       FROM student_parents sp
       JOIN students s ON s.id = sp.student_id
       JOIN users u ON u.id = s.user_id
       LEFT JOIN groups g ON g.id = s.group_id
       WHERE sp.parent_id = $1
       ORDER BY u.full_name`,
      [parent.id]
    );

    const groupIds = [...new Set(children.map((c) => c.groupId).filter((x): x is string => !!x))];
    const schoolIds = [
      ...new Set(children.map((c) => c.groupSchoolId).filter((x): x is string => !!x))
    ];
    const capBySchool = await this.fetchScheduleCapYmdBySchoolIds(schoolIds);

    const allSlots: ClassSessionEntity[] = [];
    for (const gid of groupIds) {
      const schoolId = children.find((c) => c.groupId === gid)?.groupSchoolId ?? null;
      const capYmd = schoolId ? capBySchool.get(schoolId) ?? null : null;
      const weekStartYmd = this.toYmdLocal(weekFrom);
      if (capYmd && weekStartYmd > capYmd) {
        continue;
      }
      const asOfDate = this.resolveScheduleAsOfDate(weekTo, capYmd) ?? weekTo;
      const part = await this.listEffectiveSlotsByGroup(gid, asOfDate);
      allSlots.push(...part);
    }
    const subjectIds = [...new Set(allSlots.map((s) => s.subjectId).filter((x): x is string => !!x))];
    const subjects =
      subjectIds.length > 0 ? await this.subjectsRepository.find({ where: { id: In(subjectIds) } }) : [];
    const nameById = Object.fromEntries(subjects.map((s) => [s.id, s.name]));
    const slotsByGroup = new Map<string, Array<ClassSessionEntity & { subjectName: string | null }>>();
    for (const slot of allSlots) {
      const list = slotsByGroup.get(slot.groupId) ?? [];
      list.push({
        ...slot,
        subjectName: slot.subjectId ? nameById[slot.subjectId] ?? null : null
      });
      slotsByGroup.set(slot.groupId, list);
    }

    return {
      children: children.map((child) => ({
        studentId: child.studentId,
        studentName: child.studentName,
        groupId: child.groupId,
        group: child.groupId
          ? {
              id: child.groupId,
              name: child.groupName,
              grade: child.grade,
              schoolYear: child.schoolYear
            }
          : null,
        slots: child.groupId ? slotsByGroup.get(child.groupId) ?? [] : []
      }))
    };
  }

  async listMySlotsAsTeacher(userId: string, refDateRaw?: string) {
    const refDate = this.parseRefDate(refDateRaw);
    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');
    if (teacher.lifecycleStatus !== TeacherLifecycleStatus.ACTIVO) {
      throw new ForbiddenException('El docente no está activo para consultar horarios');
    }
    const slots = await this.listEffectiveSlotsByTeacher(
      teacher.id,
      refDate ? this.endOfDay(refDate) : this.endOfDay(new Date())
    );
    if (slots.length === 0) return slots.map((s) => ({ ...s, subjectName: null, groupName: null }));
    const subjectIds = [...new Set(slots.map((s) => s.subjectId).filter((x): x is string => !!x))];
    const groupIds = [...new Set(slots.map((s) => s.groupId).filter((x): x is string => !!x))];
    const subjects =
      subjectIds.length > 0 ? await this.subjectsRepository.find({ where: { id: In(subjectIds) } }) : [];
    const groups =
      groupIds.length > 0 ? await this.groupsRepository.find({ where: { id: In(groupIds) } }) : [];
    const subjectName = Object.fromEntries(subjects.map((s) => [s.id, s.name]));
    const groupName = Object.fromEntries(
      groups.map((g) => [g.id, `${g.name}${g.grade ? ` · ${g.grade}` : ''} · ${g.schoolYear}`])
    );
    return slots.map((s) => ({
      ...s,
      subjectName: s.subjectId ? subjectName[s.subjectId] ?? null : null,
      groupName: s.groupId ? groupName[s.groupId] ?? null : null
    }));
  }

  /** Grupos donde el docente tiene asignación (para exportaciones, etc.). Opcional búsqueda y límite. */
  async listMyGroupsAsTeacher(
    userId: string,
    role: UserRole,
    opts?: { q?: string; limit?: number }
  ) {
    let qb: SelectQueryBuilder<GroupEntity>;

    if (role === UserRole.ADMIN) {
      qb = this.groupsRepository.createQueryBuilder('g');
    } else if (role === UserRole.ADMINISTRATIVO) {
      const u = await this.usersRepository.findOne({ where: { id: userId } });
      if (!u?.schoolId) {
        throw new ForbiddenException('Su usuario no tiene escuela asignada');
      }
      qb = this.groupsRepository.createQueryBuilder('g').where('g.schoolId = :sid', { sid: u.schoolId });
    } else {
      const teacher = await this.teachersRepository.findOne({ where: { userId } });
      if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');
      if (teacher.lifecycleStatus !== TeacherLifecycleStatus.ACTIVO) {
        throw new ForbiddenException('El docente no está activo para consultar grupos');
      }
      qb = this.groupsRepository
        .createQueryBuilder('g')
        .innerJoin('teacher_groups', 'tg', 'tg.group_id = g.id')
        .where('tg.teacher_id = :tid', { tid: teacher.id });
    }

    const q = opts?.q?.trim();
    if (q) {
      const like = `%${q.toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(g.name) LIKE :like OR LOWER(COALESCE(g.grade, '')) LIKE :like OR LOWER(g.schoolYear) LIKE :like)`,
        { like }
      );
    }
    qb.orderBy('g.name', 'ASC');
    qb.select(['g.id', 'g.name', 'g.grade', 'g.schoolYear', 'g.schoolId']);
    if (opts?.limit) qb.take(opts.limit);
    return qb.getMany();
  }

  async update(userId: string, role: UserRole, id: string, dto: UpdateScheduleSlotDto) {
    const session = await this.classSessionsRepository.findOne({ where: { id } });
    if (!session) throw new NotFoundException('Sesion academica no encontrada');
    const nextGroupId = dto.groupId ?? session.groupId;
    const group = await this.groupsRepository.findOne({ where: { id: nextGroupId } });
    if (!group) throw new NotFoundException('Grupo no encontrado');
    await this.assertCanManageGroupSchedule(userId, role, group.id, group.schoolId);

    const nextSubjectId = dto.subjectId ?? session.subjectId;
    const nextTeacherId = dto.teacherId ?? session.teacherId;
    await this.assertSubjectTeacherInsideSchool(group.schoolId, nextSubjectId, nextTeacherId);

    const nextWeekday = dto.weekday ?? session.weekday;
    const nextStart = this.normalizePgTime(dto.startTime ?? session.startTime);
    const nextEnd = this.normalizePgTime(dto.endTime ?? session.endTime);
    this.assertEndAfterStart(nextStart, nextEnd);

    const nextPeriod =
      group.id !== session.groupId
        ? await this.resolvePeriodForGroup(group.schoolId, group.schoolYear)
        : await this.periodsRepository.findOne({ where: { id: session.academicPeriodId } });
    if (!nextPeriod || nextPeriod.schoolId !== group.schoolId) {
      throw new BadRequestException('Periodo academico invalido para la institucion');
    }
    if (nextPeriod.schoolYear !== group.schoolYear) {
      throw new BadRequestException('Periodo y grupo deben pertenecer al mismo ano lectivo');
    }

    await this.assertNoSessionOverlap({
      schoolId: group.schoolId,
      periodId: nextPeriod.id,
      weekday: nextWeekday,
      startTime: nextStart,
      endTime: nextEnd,
      groupId: group.id,
      teacherId: nextTeacherId,
      room: dto.room === undefined ? session.room : (dto.room?.trim() || null),
      ignoreId: session.id
    });

    session.schoolId = group.schoolId;
    session.academicPeriodId = nextPeriod.id;
    session.groupId = group.id;
    session.subjectId = nextSubjectId;
    session.teacherId = nextTeacherId;
    session.weekday = nextWeekday;
    session.startTime = nextStart;
    session.endTime = nextEnd;
    if (dto.room !== undefined) session.room = dto.room?.trim() || null;
    session.updatedByUserId = userId;
    const before = {
      ...session
    };
    const saved = await this.classSessionsRepository.save(session);
    await this.notifySessionMutation('UPDATED', {
      actorUserId: userId,
      previous: before,
      current: saved
    });
    return saved;
  }

  async remove(userId: string, role: UserRole, id: string) {
    const session = await this.classSessionsRepository.findOne({ where: { id } });
    if (!session) throw new NotFoundException('Sesion academica no encontrada');
    const group = await this.groupsRepository.findOne({ where: { id: session.groupId } });
    if (!group) throw new NotFoundException('Grupo no encontrado');
    await this.assertCanManageGroupSchedule(userId, role, group.id, group.schoolId);
    const before = { ...session };
    await this.classSessionsRepository.remove(session);
    await this.notifySessionMutation('DELETED', {
      actorUserId: userId,
      previous: before
    });
    return { message: 'Sesion academica eliminada', id };
  }

  private normalizePgTime(t: string): string {
    const trimmed = t.trim();
    const parts = trimmed.split(':');
    if (parts.length < 2) throw new BadRequestException('Hora inválida');
    const h = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const s = parts[2] !== undefined ? parts[2].padStart(2, '0') : '00';
    return `${h}:${m}:${s}`;
  }

  private async listEffectiveSlotsByGroup(groupId: string, asOfDate?: Date): Promise<ClassSessionEntity[]> {
    return this.classSessionsRepository.find({
      where: {
        groupId,
        isActive: true,
        createdAt: asOfDate ? LessThanOrEqual(this.endOfDay(asOfDate)) : undefined
      },
      order: { weekday: 'ASC', startTime: 'ASC' }
    });
  }

  private async listEffectiveSlotsByTeacher(
    teacherId: string,
    asOfDate: Date
  ): Promise<ClassSessionEntity[]> {
    return this.classSessionsRepository.find({
      where: {
        teacherId,
        isActive: true,
        createdAt: LessThanOrEqual(asOfDate)
      },
      order: { weekday: 'ASC', startTime: 'ASC' }
    });
  }

  private assertEndAfterStart(start: string, end: string) {
    const toSec = (t: string) => {
      const [h, m, sec] = t.split(':').map((x) => Number.parseInt(x, 10));
      if (Number.isNaN(h) || Number.isNaN(m)) throw new BadRequestException('Hora inválida');
      return h * 3600 + m * 60 + (Number.isNaN(sec) ? 0 : sec);
    };
    const a = this.normalizePgTime(start);
    const b = this.normalizePgTime(end);
    if (toSec(b) <= toSec(a)) {
      throw new BadRequestException('La hora de fin debe ser posterior al inicio');
    }
  }

  private parseRefDate(raw?: string): Date | null {
    const trimmed = raw?.trim();
    if (!trimmed) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      throw new BadRequestException('refDate inválida, use formato YYYY-MM-DD');
    }
    const d = new Date(`${trimmed}T12:00:00`);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('refDate inválida');
    }
    return d;
  }

  private endOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  }

  private async assertCanManageGroupSchedule(
    userId: string,
    role: UserRole,
    groupId: string,
    groupSchoolId: string
  ) {
    if (role === UserRole.ADMIN) return;
    if (role !== UserRole.ADMINISTRATIVO) {
      throw new ForbiddenException('No autorizado para gestionar horarios');
    }
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user?.schoolId) throw new ForbiddenException('Usuario sin institucion asignada');
    if (user.schoolId !== groupSchoolId) {
      throw new ForbiddenException('No autorizado para gestionar horarios de otra institucion');
    }
    const group = await this.groupsRepository.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Grupo no encontrado');
  }

  private async assertSubjectTeacherInsideSchool(schoolId: string, subjectId: string, teacherId: string) {
    const [subject, teacher] = await Promise.all([
      this.subjectsRepository.findOne({ where: { id: subjectId } }),
      this.teachersRepository.findOne({ where: { id: teacherId } })
    ]);
    if (!subject) throw new NotFoundException('Asignatura no encontrada');
    if (subject.schoolId !== schoolId) throw new BadRequestException('Asignatura fuera de la institucion');
    if (!teacher) throw new NotFoundException('Docente no encontrado');
    if (teacher.lifecycleStatus !== TeacherLifecycleStatus.ACTIVO) {
      throw new BadRequestException('No se puede asignar un docente inactivo a una sesion');
    }
    const teacherUser = await this.usersRepository.findOne({ where: { id: teacher.userId } });
    if (!teacherUser?.schoolId || teacherUser.schoolId !== schoolId) {
      throw new BadRequestException('Docente fuera de la institucion');
    }
  }

  private async resolvePeriodForGroup(schoolId: string, schoolYear: string): Promise<AcademicPeriodEntity> {
    const active = await this.periodsRepository.findOne({
      where: { schoolId, schoolYear, status: AcademicPeriodStatus.ACTIVE },
      order: { orderIndex: 'ASC' }
    });
    if (active) return active;
    const planned = await this.periodsRepository.findOne({
      where: { schoolId, schoolYear, status: AcademicPeriodStatus.PLANNED },
      order: { orderIndex: 'ASC' }
    });
    if (planned) return planned;
    const closed = await this.periodsRepository.findOne({
      where: { schoolId, schoolYear, status: AcademicPeriodStatus.CLOSED },
      order: { orderIndex: 'DESC' }
    });
    if (closed) return closed;
    throw new BadRequestException(
      `No hay periodos academicos para ${schoolYear}. Cree primero al menos un periodo en la institucion.`
    );
  }

  private async assertNoSessionOverlap(input: {
    schoolId: string;
    periodId: string;
    weekday: number;
    startTime: string;
    endTime: string;
    groupId: string;
    teacherId: string;
    room: string | null;
    ignoreId?: string;
  }) {
    const qb = this.classSessionsRepository
      .createQueryBuilder('cs')
      .where('cs.schoolId = :schoolId', { schoolId: input.schoolId })
      .andWhere('cs.academicPeriodId = :periodId', { periodId: input.periodId })
      .andWhere('cs.weekday = :weekday', { weekday: input.weekday })
      .andWhere('cs.isActive = true')
      .andWhere('cs.startTime < :newEnd AND cs.endTime > :newStart', {
        newEnd: input.endTime,
        newStart: input.startTime
      });
    if (input.ignoreId) qb.andWhere('cs.id <> :ignoreId', { ignoreId: input.ignoreId });
    const clauses = ['cs.groupId = :groupId', 'cs.teacherId = :teacherId'];
    const params: Record<string, unknown> = { groupId: input.groupId, teacherId: input.teacherId };
    if (input.room) {
      clauses.push("(cs.room IS NOT NULL AND lower(cs.room) = lower(:room))");
      params.room = input.room;
    }
    qb.andWhere(`(${clauses.join(' OR ')})`, params);

    const hit = await qb.getOne();
    if (!hit) return;
    if (hit.groupId === input.groupId) {
      throw new BadRequestException('Conflicto de horario: el grupo ya tiene otra sesion en ese horario');
    }
    if (hit.teacherId === input.teacherId) {
      throw new BadRequestException('Conflicto de horario: el docente ya tiene otra sesion en ese horario');
    }
    throw new BadRequestException('Conflicto de horario: el aula ya esta ocupada en ese horario');
  }

  private async notifySessionMutation(
    mutation: 'CREATED' | 'UPDATED' | 'DELETED',
    payload: {
      actorUserId: string;
      previous?: ClassSessionEntity;
      current?: ClassSessionEntity;
    }
  ) {
    const reference = payload.current ?? payload.previous;
    if (!reference) return;

    const affectedGroupIds = [...new Set([payload.previous?.groupId, payload.current?.groupId].filter(Boolean))] as string[];
    const affectedTeacherIds = [...new Set([payload.previous?.teacherId, payload.current?.teacherId].filter(Boolean))] as string[];

    const groups = affectedGroupIds.length
      ? await this.groupsRepository.find({ where: { id: In(affectedGroupIds) } })
      : [];
    const subjects = await this.subjectsRepository.find({
      where: { id: In([payload.previous?.subjectId, payload.current?.subjectId].filter(Boolean) as string[]) }
    });
    const teachers = affectedTeacherIds.length
      ? await this.teachersRepository.find({ where: { id: In(affectedTeacherIds) } })
      : [];

    const groupById = new Map(groups.map((g) => [g.id, g]));
    const subjectById = new Map(subjects.map((s) => [s.id, s]));
    const teacherById = new Map(teachers.map((t) => [t.id, t]));

    const recipients = new Set<string>();
    for (const t of teachers) {
      recipients.add(t.userId);
    }
    const groupRecipients = await this.resolveAudienceByGroups(affectedGroupIds);
    for (const uid of groupRecipients) recipients.add(uid);
    recipients.delete(payload.actorUserId);

    if (recipients.size === 0) return;

    const newGroup = payload.current ? groupById.get(payload.current.groupId) : null;
    const oldGroup = payload.previous ? groupById.get(payload.previous.groupId) : null;
    const currentSubject = payload.current ? subjectById.get(payload.current.subjectId)?.name ?? 'Clase' : 'Clase';
    const previousSubject = payload.previous ? subjectById.get(payload.previous.subjectId)?.name ?? 'Clase' : 'Clase';
    const currentTeacherUserId = payload.current
      ? teacherById.get(payload.current.teacherId)?.userId ?? null
      : null;
    const previousTeacherUserId = payload.previous
      ? teacherById.get(payload.previous.teacherId)?.userId ?? null
      : null;
    const currentTeacher = currentTeacherUserId
      ? await this.usersRepository.findOne({ where: { id: currentTeacherUserId } })
      : null;
    const previousTeacher = previousTeacherUserId
      ? await this.usersRepository.findOne({ where: { id: previousTeacherUserId } })
      : null;

    const title =
      mutation === 'CREATED'
        ? '[Horario] Nueva sesion creada'
        : mutation === 'UPDATED'
          ? '[Horario] Sesion actualizada'
          : '[Horario] Sesion eliminada';
    const details: string[] = [];
    if (mutation === 'CREATED' && payload.current) {
      details.push(`Materia: ${currentSubject}`);
      details.push(`Grupo: ${newGroup ? `${newGroup.name} · ${newGroup.schoolYear}` : payload.current.groupId}`);
      details.push(`Docente: ${currentTeacher?.fullName ?? 'No especificado'}`);
      details.push(`Horario: ${this.weekdayName(payload.current.weekday)} ${payload.current.startTime.slice(0, 5)}-${payload.current.endTime.slice(0, 5)}`);
    }
    if (mutation === 'UPDATED' && payload.current && payload.previous) {
      details.push(`Materia: ${previousSubject} -> ${currentSubject}`);
      details.push(`Grupo: ${oldGroup ? `${oldGroup.name} · ${oldGroup.schoolYear}` : payload.previous.groupId} -> ${newGroup ? `${newGroup.name} · ${newGroup.schoolYear}` : payload.current.groupId}`);
      details.push(
        `Docente: ${previousTeacher?.fullName ?? 'No especificado'} -> ${currentTeacher?.fullName ?? 'No especificado'}`
      );
      details.push(
        `Horario: ${this.weekdayName(payload.previous.weekday)} ${payload.previous.startTime.slice(0, 5)}-${payload.previous.endTime.slice(0, 5)} -> ${this.weekdayName(payload.current.weekday)} ${payload.current.startTime.slice(0, 5)}-${payload.current.endTime.slice(0, 5)}`
      );
    }
    if (mutation === 'DELETED' && payload.previous) {
      details.push(`Materia: ${previousSubject}`);
      details.push(`Grupo: ${oldGroup ? `${oldGroup.name} · ${oldGroup.schoolYear}` : payload.previous.groupId}`);
      details.push(`Docente: ${previousTeacher?.fullName ?? 'No especificado'}`);
      details.push(`Horario: ${this.weekdayName(payload.previous.weekday)} ${payload.previous.startTime.slice(0, 5)}-${payload.previous.endTime.slice(0, 5)}`);
    }
    const message = details.join('\n');

    const rows = [...recipients].map((userId) =>
      this.notificationsRepository.create({
        userId,
        noticeId: null,
        title,
        message,
        deliveryStatus: 'SENT'
      })
    );
    const savedRows = await this.notificationsRepository.save(rows);
    void this.fcmService.sendPushForNotifications(savedRows).catch((err: unknown) => {
      this.logger.warn(`Push de horario no enviado: ${String(err)}`);
    });
  }

  private weekdayName(weekday: number): string {
    const names = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    return names[weekday] ?? `dia-${weekday}`;
  }

  private async resolveAudienceByGroups(groupIds: string[]): Promise<string[]> {
    if (groupIds.length === 0) return [];
    const rows = await this.dataSource.query<{ user_id: string }[]>(
      `SELECT DISTINCT u.id AS user_id
       FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE s.group_id = ANY($1::uuid[])
       UNION
       SELECT DISTINCT up.id AS user_id
       FROM students s
       JOIN student_parents sp ON sp.student_id = s.id
       JOIN parents p ON p.id = sp.parent_id
       JOIN users up ON up.id = p.user_id
       WHERE s.group_id = ANY($1::uuid[])`,
      [groupIds]
    );
    return rows.map((r) => r.user_id);
  }

  /** Fecha tope (YYYY-MM-DD) según el cierre más tardío de periodos CLOSED de la escuela; null si no hay cierres. */
  private async fetchScheduleCapYmdForSchool(schoolId: string): Promise<string | null> {
    const map = await this.fetchScheduleCapYmdBySchoolIds([schoolId]);
    return map.get(schoolId) ?? null;
  }

  private async fetchScheduleCapYmdBySchoolIds(schoolIds: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (schoolIds.length === 0) return out;
    const rows = await this.studentsRepository.manager.query<{ schoolId: string; cap: string | null }[]>(
      `SELECT ap.school_id::text AS "schoolId",
              TO_CHAR(MAX(COALESCE(DATE(ap.closed_at), ap.end_date)), 'YYYY-MM-DD') AS cap
       FROM academic_periods ap
       WHERE ap.status = $2
         AND ap.school_id = ANY($1::uuid[])
       GROUP BY ap.school_id`,
      [schoolIds, AcademicPeriodStatus.CLOSED]
    );
    for (const r of rows) {
      if (r.cap) out.set(r.schoolId, r.cap);
    }
    return out;
  }

  private toYmdLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /**
   * Fecha "hasta la cual" aplicar createdAt <= endOfDay(asOf): fin de semana solicitada acotada al último cierre institucional.
   */
  private resolveScheduleAsOfDate(weekEnd: Date | null, capYmd: string | null): Date | null {
    if (!weekEnd) return null;
    if (!capYmd) return weekEnd;
    const endYmd = this.toYmdLocal(weekEnd);
    const asOfYmd = endYmd <= capYmd ? endYmd : capYmd;
    return this.parseRefDate(asOfYmd);
  }

  private async assertCanViewGroupSchedule(userId: string, role: UserRole, groupId: string) {
    if (role === UserRole.ADMIN) return;
    if (role === UserRole.ADMINISTRATIVO) {
      const rows = await this.studentsRepository.manager.query<{ ok: boolean }[]>(
        `SELECT EXISTS (
           SELECT 1
           FROM users admin_user
           JOIN groups g ON g.id = $2
           WHERE admin_user.id = $1
             AND admin_user.role = 'ADMINISTRATIVO'
             AND admin_user.school_id IS NOT NULL
             AND admin_user.school_id = g.school_id
        ) AS ok`,
        [userId, groupId]
      );
      if (!rows[0]?.ok) throw new ForbiddenException('No autorizado a ver el horario de este grupo');
      return;
    }
    if (role === UserRole.DOCENTE) {
      const teacher = await this.teachersRepository.findOne({ where: { userId } });
      if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');
      const rows = await this.studentsRepository.manager.query<{ ok: boolean }[]>(
        `SELECT EXISTS (
          SELECT 1 FROM teacher_groups WHERE teacher_id = $1 AND group_id = $2
        ) AS ok`,
        [teacher.id, groupId]
      );
      if (!rows[0]?.ok) {
        throw new ForbiddenException('No tienes asignación en este grupo');
      }
      return;
    }
    if (role === UserRole.PADRE) {
      const parent = await this.parentsRepository.findOne({ where: { userId } });
      if (!parent) throw new ForbiddenException('Perfil padre no encontrado');
      const rows = await this.studentsRepository.manager.query<{ ok: boolean }[]>(
        `SELECT EXISTS (
          SELECT 1 FROM student_parents sp
          JOIN students s ON s.id = sp.student_id
          WHERE sp.parent_id = $1 AND s.group_id = $2
        ) AS ok`,
        [parent.id, groupId]
      );
      if (!rows[0]?.ok) {
        throw new ForbiddenException('No tienes hijos en este grupo');
      }
      return;
    }
    if (role === UserRole.ALUMNO) {
      const student = await this.studentsRepository.findOne({ where: { userId } });
      if (!student) throw new ForbiddenException('Perfil de estudiante no encontrado');
      if (!student.groupId || student.groupId !== groupId) {
        throw new ForbiddenException('No autorizado a ver el horario de este grupo');
      }
      return;
    }
    throw new ForbiddenException('No autorizado a ver el horario de este grupo');
  }
}