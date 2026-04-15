import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ClassScheduleSlotEntity } from '../../database/entities/class-schedule-slot.entity';
import { GroupEntity } from '../../database/entities/group.entity';
import { SubjectEntity } from '../../database/entities/subject.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { CreateScheduleSlotDto } from './dto/create-schedule-slot.dto';
import { UpdateScheduleSlotDto } from './dto/update-schedule-slot.dto';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(ClassScheduleSlotEntity)
    private readonly slotsRepository: Repository<ClassScheduleSlotEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupsRepository: Repository<GroupEntity>,
    @InjectRepository(SubjectEntity)
    private readonly subjectsRepository: Repository<SubjectEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentsRepository: Repository<StudentEntity>,
    @InjectRepository(ParentEntity)
    private readonly parentsRepository: Repository<ParentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachersRepository: Repository<TeacherEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>
  ) {}

  async create(dto: CreateScheduleSlotDto) {
    const group = await this.groupsRepository.findOne({ where: { id: dto.groupId } });
    if (!group) throw new NotFoundException('Grupo no encontrado');

    this.assertEndAfterStart(dto.startTime, dto.endTime);

    const row = this.slotsRepository.create({
      groupId: dto.groupId,
      weekday: dto.weekday,
      startTime: this.normalizePgTime(dto.startTime),
      endTime: this.normalizePgTime(dto.endTime),
      subjectId: dto.subjectId ?? null,
      teacherId: dto.teacherId ?? null,
      room: dto.room?.trim() ?? null
    });
    return this.slotsRepository.save(row);
  }

  async listByGroup(groupId: string, userId: string, role: UserRole) {
    const group = await this.groupsRepository.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Grupo no encontrado');

    await this.assertCanViewGroupSchedule(userId, role, groupId);

    return this.slotsRepository.find({
      where: { groupId },
      order: { weekday: 'ASC', startTime: 'ASC' }
    });
  }

  /** Todas las franjas horarias donde figura el docente (cualquier grupo). */
  /** Horario del grupo del estudiante (franjas semanales). */
  async listMySlotsAsStudent(userId: string) {
    const student = await this.studentsRepository.findOne({ where: { userId } });
    if (!student) throw new ForbiddenException('Perfil de estudiante no encontrado');
    if (!student.groupId) {
      return {
        groupId: null as string | null,
        group: null as { id: string; name: string; grade: string | null; schoolYear: string } | null,
        slots: [] as Array<
          ClassScheduleSlotEntity & { subjectName: string | null }
        >
      };
    }
    const group = await this.groupsRepository.findOne({ where: { id: student.groupId } });
    const slots = await this.slotsRepository.find({
      where: { groupId: student.groupId },
      order: { weekday: 'ASC', startTime: 'ASC' }
    });
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

  async listMyChildrenSlotsAsParent(userId: string) {
    const parent = await this.parentsRepository.findOne({ where: { userId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');

    const children = await this.studentsRepository.manager.query<
      { studentId: string; studentName: string; groupId: string | null; groupName: string | null; grade: string | null; schoolYear: string | null }[]
    >(
      `SELECT s.id AS "studentId",
              u.full_name AS "studentName",
              s.group_id AS "groupId",
              g.name AS "groupName",
              g.grade AS "grade",
              g.school_year AS "schoolYear"
       FROM student_parents sp
       JOIN students s ON s.id = sp.student_id
       JOIN users u ON u.id = s.user_id
       LEFT JOIN groups g ON g.id = s.group_id
       WHERE sp.parent_id = $1
       ORDER BY u.full_name`,
      [parent.id]
    );

    const groupIds = [...new Set(children.map((c) => c.groupId).filter((x): x is string => !!x))];
    const allSlots =
      groupIds.length > 0
        ? await this.slotsRepository.find({
            where: { groupId: In(groupIds) },
            order: { weekday: 'ASC', startTime: 'ASC' }
          })
        : [];
    const subjectIds = [...new Set(allSlots.map((s) => s.subjectId).filter((x): x is string => !!x))];
    const subjects =
      subjectIds.length > 0 ? await this.subjectsRepository.find({ where: { id: In(subjectIds) } }) : [];
    const nameById = Object.fromEntries(subjects.map((s) => [s.id, s.name]));
    const slotsByGroup = new Map<string, Array<ClassScheduleSlotEntity & { subjectName: string | null }>>();
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

  async listMySlotsAsTeacher(userId: string) {
    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');
    return this.slotsRepository.find({
      where: { teacherId: teacher.id },
      order: { weekday: 'ASC', startTime: 'ASC' }
    });
  }

  /** Grupos donde el docente tiene asignación (para exportaciones, etc.). */
  async listMyGroupsAsTeacher(userId: string, role: UserRole) {
    if (role === UserRole.ADMIN) {
      return this.groupsRepository
        .createQueryBuilder('g')
        .orderBy('g.name', 'ASC')
        .select(['g.id', 'g.name', 'g.grade', 'g.schoolYear'])
        .getMany();
    }

    if (role === UserRole.ADMINISTRATIVO) {
      const u = await this.usersRepository.findOne({ where: { id: userId } });
      if (!u?.schoolId) {
        throw new ForbiddenException('Su usuario no tiene escuela asignada');
      }
      return this.groupsRepository
        .createQueryBuilder('g')
        .where('g.school_id = :sid', { sid: u.schoolId })
        .orderBy('g.name', 'ASC')
        .select(['g.id', 'g.name', 'g.grade', 'g.schoolYear'])
        .getMany();
    }

    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');
    return this.groupsRepository
      .createQueryBuilder('g')
      .innerJoin('teacher_groups', 'tg', 'tg.group_id = g.id')
      .where('tg.teacher_id = :tid', { tid: teacher.id })
      .orderBy('g.name', 'ASC')
      .select(['g.id', 'g.name', 'g.grade', 'g.schoolYear'])
      .getMany();
  }

  async update(id: string, dto: UpdateScheduleSlotDto) {
    const row = await this.slotsRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Franja no encontrada');

    const start = dto.startTime ?? row.startTime;
    const end = dto.endTime ?? row.endTime;
    this.assertEndAfterStart(start, end);

    if (dto.weekday !== undefined) row.weekday = dto.weekday;
    if (dto.startTime !== undefined) row.startTime = this.normalizePgTime(dto.startTime);
    if (dto.endTime !== undefined) row.endTime = this.normalizePgTime(dto.endTime);
    if (dto.subjectId !== undefined) row.subjectId = dto.subjectId;
    if (dto.teacherId !== undefined) row.teacherId = dto.teacherId;
    if (dto.room !== undefined) row.room = dto.room?.trim() ?? null;

    return this.slotsRepository.save(row);
  }

  async remove(id: string) {
    const row = await this.slotsRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Franja no encontrada');
    await this.slotsRepository.remove(row);
    return { message: 'Franja eliminada', id };
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