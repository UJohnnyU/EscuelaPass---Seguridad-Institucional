import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import {
  VisitRequestEntity,
  VisitRequestStatus
} from '../../database/entities/visit-request.entity';
import { UserRole } from '../../database/entities/user.entity';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitStatusDto } from './dto/update-visit-status.dto';

@Injectable()
export class VisitsService {
  constructor(
    @InjectRepository(VisitRequestEntity)
    private readonly visitsRepository: Repository<VisitRequestEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentsRepository: Repository<StudentEntity>,
    @InjectRepository(ParentEntity)
    private readonly parentsRepository: Repository<ParentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachersRepository: Repository<TeacherEntity>
  ) {}

  async create(dto: CreateVisitDto, parentUserId: string) {
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');

    await this.assertParentLinkedToStudent(parent.id, dto.studentId);

    const row = this.visitsRepository.create({
      parentId: parent.id,
      studentId: dto.studentId,
      visitDatetime: new Date(dto.visitDatetime),
      reason: dto.reason?.trim() ?? null,
      status: VisitRequestStatus.PENDIENTE
    });
    return this.visitsRepository.save(row);
  }

  async listMine(parentUserId: string) {
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');

    return this.visitsRepository.find({
      where: { parentId: parent.id },
      order: { visitDatetime: 'DESC' }
    });
  }

  async listForStaff(userId: string, role: UserRole) {
    if (role === UserRole.ADMIN || role === UserRole.ADMINISTRATIVO) {
      return this.visitsRepository.find({ order: { visitDatetime: 'DESC' } });
    }
    if (role !== UserRole.DOCENTE) {
      throw new ForbiddenException('No autorizado');
    }
    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');

    return this.visitsRepository
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

  async updateStatus(id: string, dto: UpdateVisitStatusDto, userId: string, role: UserRole) {
    const row = await this.visitsRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Solicitud no encontrada');

    if (role === UserRole.ADMIN || role === UserRole.ADMINISTRATIVO) {
      row.status = dto.status;
      return this.visitsRepository.save(row);
    }
    if (role !== UserRole.DOCENTE) {
      throw new ForbiddenException('No autorizado');
    }
    await this.assertDocenteCanAccessStudentGroup(userId, row.studentId);
    row.status = dto.status;
    return this.visitsRepository.save(row);
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
