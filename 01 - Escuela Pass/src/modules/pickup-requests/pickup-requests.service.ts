import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParentEntity } from '../../database/entities/parent.entity';
import {
  PickupRequestEntity,
  PickupRequestStatus
} from '../../database/entities/pickup-request.entity';
import { StudentEntity, StudentLifecycleStatus } from '../../database/entities/student.entity';
import { TeacherEntity, TeacherLifecycleStatus } from '../../database/entities/teacher.entity';
import { UserRole } from '../../database/entities/user.entity';
import { CreatePickupRequestDto } from './dto/create-pickup-request.dto';
import { UpdatePickupRequestStatusDto } from './dto/update-pickup-request-status.dto';

@Injectable()
export class PickupRequestsService {
  constructor(
    @InjectRepository(PickupRequestEntity)
    private readonly requestsRepository: Repository<PickupRequestEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentsRepository: Repository<StudentEntity>,
    @InjectRepository(ParentEntity)
    private readonly parentsRepository: Repository<ParentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachersRepository: Repository<TeacherEntity>
  ) {}

  async create(dto: CreatePickupRequestDto, parentUserId: string) {
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');

    await this.assertParentLinkedToStudent(parent.id, dto.studentId);

    const row = this.requestsRepository.create({
      parentId: parent.id,
      studentId: dto.studentId,
      visitDatetime: new Date(dto.visitDatetime),
      reason: dto.reason?.trim() ?? null,
      status: PickupRequestStatus.PENDIENTE
    });
    return this.requestsRepository.save(row);
  }

  async listMine(parentUserId: string) {
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');

    return this.requestsRepository.find({
      where: { parentId: parent.id },
      order: { visitDatetime: 'DESC' }
    });
  }

  async listForStaff(userId: string, role: UserRole) {
    if (role === UserRole.ADMIN) {
      return this.requestsRepository.find({ order: { visitDatetime: 'DESC' } });
    }
    if (role === UserRole.ADMINISTRATIVO) {
      return this.requestsRepository
        .createQueryBuilder('vr')
        .innerJoin('students', 's', 's.id = vr.student_id')
        .innerJoin('groups', 'g', 'g.id = s.group_id')
        .innerJoin('users', 'u', 'u.id = :uid', { uid: userId })
        .where('u.school_id = g.school_id')
        .orderBy('vr.visit_datetime', 'DESC')
        .getMany();
    }
    if (role !== UserRole.DOCENTE) {
      throw new ForbiddenException('No autorizado');
    }
    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');
    if (teacher.lifecycleStatus !== TeacherLifecycleStatus.ACTIVO) {
      throw new ForbiddenException('El docente no está activo para gestionar solicitudes');
    }

    return this.requestsRepository
      .createQueryBuilder('vr')
      .innerJoin('students', 's', 's.id = vr.student_id')
      .where('s.group_id IS NOT NULL')
      .andWhere(
        `EXISTS (SELECT 1 FROM teacher_groups tg WHERE tg.teacher_id = :tid AND tg.group_id = s.group_id)`,
        { tid: teacher.id }
      )
      .orderBy('vr.visit_datetime', 'DESC')
      .getMany();
  }

  async updateStatus(id: string, dto: UpdatePickupRequestStatusDto, userId: string, role: UserRole) {
    const row = await this.requestsRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Solicitud no encontrada');

    if (role === UserRole.ADMIN) {
      row.status = dto.status;
      return this.requestsRepository.save(row);
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
      return this.requestsRepository.save(row);
    }
    if (role !== UserRole.DOCENTE) {
      throw new ForbiddenException('No autorizado');
    }
    await this.assertDocenteCanAccessStudentGroup(userId, row.studentId);
    row.status = dto.status;
    return this.requestsRepository.save(row);
  }

  private async assertParentLinkedToStudent(parentId: string, studentId: string) {
    const student = await this.studentsRepository.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Estudiante no encontrado');
    if (student.lifecycleStatus !== StudentLifecycleStatus.ACTIVO) {
      throw new ForbiddenException('El estudiante no está activo para solicitudes de recogida');
    }

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

  private async assertDocenteCanAccessStudentGroup(userId: string, studentId: string) {
    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');
    const student = await this.studentsRepository.findOne({ where: { id: studentId } });
    if (!student?.groupId) {
      throw new ForbiddenException('El estudiante no tiene grupo asignado');
    }
    const rows = await this.studentsRepository.manager.query<{ ok: boolean }[]>(
      `SELECT EXISTS (
        SELECT 1 FROM teacher_groups WHERE teacher_id = $1 AND group_id = $2
      ) AS ok`,
      [teacher.id, student.groupId]
    );
    if (!rows[0]?.ok) {
      throw new ForbiddenException('No tienes asignación en el grupo de este estudiante');
    }
  }
}
