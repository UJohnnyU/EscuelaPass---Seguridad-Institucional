import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MeetingStatus,
  ParentTeacherMeetingEntity
} from '../../database/entities/parent-teacher-meeting.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { UserRole } from '../../database/entities/user.entity';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingStatusDto } from './dto/update-meeting-status.dto';

@Injectable()
export class MeetingsService {
  constructor(
    @InjectRepository(ParentTeacherMeetingEntity)
    private readonly meetingsRepository: Repository<ParentTeacherMeetingEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentsRepository: Repository<StudentEntity>,
    @InjectRepository(ParentEntity)
    private readonly parentsRepository: Repository<ParentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachersRepository: Repository<TeacherEntity>
  ) {}

  async create(dto: CreateMeetingDto, parentUserId: string) {
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');

    await this.assertParentLinkedToStudent(parent.id, dto.studentId);

    const student = await this.studentsRepository.findOne({ where: { id: dto.studentId } });
    if (!student?.groupId) {
      throw new ForbiddenException('El estudiante debe tener grupo para agendar reunión');
    }

    const teacher = await this.teachersRepository.findOne({ where: { id: dto.teacherId } });
    if (!teacher) throw new NotFoundException('Docente no encontrado');

    const assigned = await this.studentsRepository.manager.query<{ ok: boolean }[]>(
      `SELECT EXISTS (
        SELECT 1 FROM teacher_groups WHERE teacher_id = $1 AND group_id = $2
      ) AS ok`,
      [teacher.id, student.groupId]
    );
    if (!assigned[0]?.ok) {
      throw new ForbiddenException('El docente no imparte en el grupo del estudiante');
    }

    const row = this.meetingsRepository.create({
      parentId: parent.id,
      teacherId: dto.teacherId,
      studentId: dto.studentId,
      meetingDatetime: new Date(dto.meetingDatetime),
      durationMinutes: dto.durationMinutes ?? 30,
      topic: dto.topic?.trim() ?? null,
      notes: null,
      status: MeetingStatus.PENDIENTE
    });
    return this.meetingsRepository.save(row);
  }

  async listMine(parentUserId: string) {
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');

    return this.meetingsRepository.find({
      where: { parentId: parent.id },
      order: { meetingDatetime: 'DESC' }
    });
  }

  async listForStaff(userId: string, role: UserRole) {
    if (role === UserRole.ADMIN) {
      return this.meetingsRepository.find({ order: { meetingDatetime: 'DESC' } });
    }
    if (role === UserRole.ADMINISTRATIVO) {
      return this.meetingsRepository
        .createQueryBuilder('m')
        .innerJoin('students', 's', 's.id = m.student_id')
        .innerJoin('groups', 'g', 'g.id = s.group_id')
        .innerJoin('users', 'u', 'u.id = :uid', { uid: userId })
        .where('u.school_id = g.school_id')
        .orderBy('m.meeting_datetime', 'DESC')
        .getMany();
    }
    if (role !== UserRole.DOCENTE) {
      throw new ForbiddenException('No autorizado');
    }
    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');

    return this.meetingsRepository.find({
      where: { teacherId: teacher.id },
      order: { meetingDatetime: 'DESC' }
    });
  }

  async updateStatus(id: string, dto: UpdateMeetingStatusDto, userId: string, role: UserRole) {
    const row = await this.meetingsRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Reunión no encontrada');

    if (role === UserRole.ADMIN) {
      row.status = dto.status;
      return this.meetingsRepository.save(row);
    }
    if (role === UserRole.ADMINISTRATIVO) {
      const st = await this.studentsRepository.findOne({ where: { id: row.studentId } });
      if (!st?.groupId) throw new ForbiddenException('Estudiante sin grupo asignado');
      const rows = await this.studentsRepository.manager.query<{ ok: boolean }[]>(
        `SELECT EXISTS (
           SELECT 1 FROM users u
           JOIN groups g ON g.id = $2
           WHERE u.id = $1 AND u.role = 'ADMINISTRATIVO'
             AND u.school_id IS NOT NULL
             AND u.school_id = g.school_id
        ) AS ok`,
        [userId, st.groupId]
      );
      if (!rows[0]?.ok) throw new ForbiddenException('No autorizado');
      row.status = dto.status;
      return this.meetingsRepository.save(row);
    }
    if (role !== UserRole.DOCENTE) {
      throw new ForbiddenException('No autorizado');
    }
    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');
    if (row.teacherId !== teacher.id) {
      throw new ForbiddenException('Solo el docente convocado puede actualizar el estado');
    }
    row.status = dto.status;
    return this.meetingsRepository.save(row);
  }

  private async assertParentLinkedToStudent(parentId: string, studentId: string) {
    const student = await this.studentsRepository.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Estudiante no encontrado');

    const rows = await this.studentsRepository.manager.query<{ ok: boolean }[]>(
      `SELECT EXISTS (
        SELECT 1 FROM student_parents sp
        WHERE sp.parent_id = $1 AND sp.student_id = $2
      ) AS ok`,
      [parentId, studentId]
    );
    if (!rows[0]?.ok) {
      throw new ForbiddenException('No eres tutor de este estudiante');
    }
  }
}
