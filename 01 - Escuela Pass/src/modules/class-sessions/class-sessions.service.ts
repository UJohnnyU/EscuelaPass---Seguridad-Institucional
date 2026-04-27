import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AcademicPeriodEntity } from '../../database/entities/academic-period.entity';
import { ClassSessionEntity } from '../../database/entities/class-session.entity';
import { GroupEntity } from '../../database/entities/group.entity';
import { SubjectEntity } from '../../database/entities/subject.entity';
import { TeacherEntity, TeacherLifecycleStatus } from '../../database/entities/teacher.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { CreateClassSessionDto } from './dto/create-class-session.dto';
import { UpdateClassSessionDto } from './dto/update-class-session.dto';

@Injectable()
export class ClassSessionsService {
  constructor(
    @InjectRepository(ClassSessionEntity)
    private readonly classSessionsRepository: Repository<ClassSessionEntity>,
    @InjectRepository(AcademicPeriodEntity)
    private readonly academicPeriodsRepository: Repository<AcademicPeriodEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupsRepository: Repository<GroupEntity>,
    @InjectRepository(SubjectEntity)
    private readonly subjectsRepository: Repository<SubjectEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachersRepository: Repository<TeacherEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>
  ) {}

  async list(
    userId: string,
    role: UserRole,
    filters?: {
      schoolId?: string;
      academicPeriodId?: string;
      groupId?: string;
      teacherId?: string;
      subjectId?: string;
      weekday?: number;
      activeOnly?: boolean;
    }
  ) {
    const schoolId = await this.resolveSchoolScope(userId, role, filters?.schoolId);
    const qb = this.classSessionsRepository
      .createQueryBuilder('cs')
      .where('cs.schoolId = :schoolId', { schoolId });

    if (filters?.academicPeriodId) qb.andWhere('cs.academicPeriodId = :periodId', { periodId: filters.academicPeriodId });
    if (filters?.groupId) qb.andWhere('cs.groupId = :groupId', { groupId: filters.groupId });
    if (filters?.teacherId) qb.andWhere('cs.teacherId = :teacherId', { teacherId: filters.teacherId });
    if (filters?.subjectId) qb.andWhere('cs.subjectId = :subjectId', { subjectId: filters.subjectId });
    if (filters?.weekday !== undefined) qb.andWhere('cs.weekday = :weekday', { weekday: filters.weekday });
    if (filters?.activeOnly) qb.andWhere('cs.isActive = true');

    qb.orderBy('cs.weekday', 'ASC').addOrderBy('cs.startTime', 'ASC');
    return qb.getMany();
  }

  async create(userId: string, role: UserRole, dto: CreateClassSessionDto) {
    this.assertEndAfterStart(dto.startTime, dto.endTime);
    const schoolId = await this.resolveSchoolScope(userId, role, dto.schoolId);
    await this.assertReferencesWithinSchool({
      schoolId,
      academicPeriodId: dto.academicPeriodId,
      groupId: dto.groupId,
      subjectId: dto.subjectId,
      teacherId: dto.teacherId
    });

    const startTime = this.normalizePgTime(dto.startTime);
    const endTime = this.normalizePgTime(dto.endTime);
    await this.assertNoTimeConflict({
      schoolId,
      academicPeriodId: dto.academicPeriodId,
      weekday: dto.weekday,
      startTime,
      endTime,
      groupId: dto.groupId,
      teacherId: dto.teacherId,
      room: dto.room?.trim() || null
    });

    const row = this.classSessionsRepository.create({
      schoolId,
      academicPeriodId: dto.academicPeriodId,
      groupId: dto.groupId,
      subjectId: dto.subjectId,
      teacherId: dto.teacherId,
      weekday: dto.weekday,
      startTime,
      endTime,
      room: dto.room?.trim() || null,
      isActive: dto.isActive ?? true,
      createdByUserId: userId,
      updatedByUserId: userId
    });
    return this.classSessionsRepository.save(row);
  }

  async update(userId: string, role: UserRole, id: string, dto: UpdateClassSessionDto) {
    const current = await this.classSessionsRepository.findOne({ where: { id } });
    if (!current) throw new NotFoundException('Sesion academica no encontrada');

    const schoolId = await this.resolveSchoolScope(userId, role, current.schoolId);
    if (current.schoolId !== schoolId) {
      throw new ForbiddenException('No autorizado para editar esta sesion');
    }

    const next = {
      schoolId: current.schoolId,
      academicPeriodId: dto.academicPeriodId ?? current.academicPeriodId,
      groupId: dto.groupId ?? current.groupId,
      subjectId: dto.subjectId ?? current.subjectId,
      teacherId: dto.teacherId ?? current.teacherId,
      weekday: dto.weekday ?? current.weekday,
      startTime: this.normalizePgTime(dto.startTime ?? current.startTime),
      endTime: this.normalizePgTime(dto.endTime ?? current.endTime),
      room: dto.room === undefined ? current.room : (dto.room?.trim() || null),
      isActive: dto.isActive ?? current.isActive
    };

    this.assertEndAfterStart(next.startTime, next.endTime);
    await this.assertReferencesWithinSchool(next);
    await this.assertNoTimeConflict({ ...next, ignoreId: current.id });

    current.academicPeriodId = next.academicPeriodId;
    current.groupId = next.groupId;
    current.subjectId = next.subjectId;
    current.teacherId = next.teacherId;
    current.weekday = next.weekday;
    current.startTime = next.startTime;
    current.endTime = next.endTime;
    current.room = next.room;
    current.isActive = next.isActive;
    current.updatedByUserId = userId;
    return this.classSessionsRepository.save(current);
  }

  async remove(userId: string, role: UserRole, id: string) {
    const row = await this.classSessionsRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Sesion academica no encontrada');
    const schoolId = await this.resolveSchoolScope(userId, role, row.schoolId);
    if (row.schoolId !== schoolId) {
      throw new ForbiddenException('No autorizado para eliminar esta sesion');
    }
    await this.classSessionsRepository.remove(row);
    return { message: 'Sesion academica eliminada', id };
  }

  private normalizePgTime(t: string): string {
    const trimmed = t.trim();
    const parts = trimmed.split(':');
    if (parts.length < 2) throw new BadRequestException('Hora invalida');
    const h = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const s = parts[2] !== undefined ? parts[2].padStart(2, '0') : '00';
    return `${h}:${m}:${s}`;
  }

  private assertEndAfterStart(start: string, end: string) {
    const toSec = (t: string) => {
      const [h, m, sec] = t.split(':').map((x) => Number.parseInt(x, 10));
      if (Number.isNaN(h) || Number.isNaN(m)) throw new BadRequestException('Hora invalida');
      return h * 3600 + m * 60 + (Number.isNaN(sec) ? 0 : sec);
    };
    if (toSec(end) <= toSec(start)) {
      throw new BadRequestException('La hora de fin debe ser posterior a la hora de inicio');
    }
  }

  private async resolveSchoolScope(userId: string, role: UserRole, requestedSchoolId?: string): Promise<string> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new ForbiddenException('Usuario no encontrado');

    if (role === UserRole.ADMIN) {
      const sid = requestedSchoolId?.trim() ?? '';
      if (!sid) throw new BadRequestException('Admin debe indicar una institucion');
      return sid;
    }
    if (role === UserRole.ADMINISTRATIVO) {
      if (!user.schoolId) throw new ForbiddenException('Usuario sin institucion asignada');
      if (requestedSchoolId && requestedSchoolId !== user.schoolId) {
        throw new ForbiddenException('No autorizado para otra institucion');
      }
      return user.schoolId;
    }
    throw new ForbiddenException('No autorizado para gestionar sesiones academicas');
  }

  private async assertReferencesWithinSchool(input: {
    schoolId: string;
    academicPeriodId: string;
    groupId: string;
    subjectId: string;
    teacherId: string;
  }) {
    const [period, group, subject, teacher] = await Promise.all([
      this.academicPeriodsRepository.findOne({ where: { id: input.academicPeriodId } }),
      this.groupsRepository.findOne({ where: { id: input.groupId } }),
      this.subjectsRepository.findOne({ where: { id: input.subjectId } }),
      this.teachersRepository.findOne({ where: { id: input.teacherId } })
    ]);

    if (!period) throw new NotFoundException('Periodo academico no encontrado');
    if (!group) throw new NotFoundException('Grupo no encontrado');
    if (!subject) throw new NotFoundException('Asignatura no encontrada');
    if (!teacher) throw new NotFoundException('Docente no encontrado');
    if (teacher.lifecycleStatus !== TeacherLifecycleStatus.ACTIVO) {
      throw new BadRequestException('No se puede usar un docente inactivo en una sesión');
    }

    if (period.schoolId !== input.schoolId) throw new BadRequestException('Periodo fuera de la institucion');
    if (group.schoolId !== input.schoolId) throw new BadRequestException('Grupo fuera de la institucion');
    if (subject.schoolId !== input.schoolId) throw new BadRequestException('Asignatura fuera de la institucion');

    const teacherUser = await this.usersRepository.findOne({ where: { id: teacher.userId } });
    if (!teacherUser?.schoolId) {
      throw new BadRequestException('Docente sin institucion valida');
    }
    if (teacherUser.schoolId !== input.schoolId) {
      throw new BadRequestException('Docente fuera de la institucion');
    }
    if (period.schoolYear !== group.schoolYear) {
      throw new BadRequestException('Periodo y grupo deben pertenecer al mismo ano lectivo');
    }
    const assignment = await this.classSessionsRepository.query(
      `
      SELECT 1
      FROM teacher_groups
      WHERE teacher_id = $1
        AND group_id = $2
        AND subject_id = $3
      LIMIT 1
      `,
      [input.teacherId, input.groupId, input.subjectId]
    );
    if (!Array.isArray(assignment) || assignment.length === 0) {
      throw new BadRequestException(
        'Primero asigne el docente a este grupo y asignatura antes de crear la sesión de horario'
      );
    }
  }

  private async assertNoTimeConflict(input: {
    schoolId: string;
    academicPeriodId: string;
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
      .andWhere('cs.academicPeriodId = :periodId', { periodId: input.academicPeriodId })
      .andWhere('cs.weekday = :weekday', { weekday: input.weekday })
      .andWhere('cs.isActive = true')
      .andWhere('cs.startTime < :newEnd AND cs.endTime > :newStart', {
        newEnd: input.endTime,
        newStart: input.startTime
      });

    if (input.ignoreId) qb.andWhere('cs.id <> :ignoreId', { ignoreId: input.ignoreId });

    const params: Record<string, unknown> = {
      groupId: input.groupId,
      teacherId: input.teacherId
    };
    const clauses = ['cs.groupId = :groupId', 'cs.teacherId = :teacherId'];
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
}
