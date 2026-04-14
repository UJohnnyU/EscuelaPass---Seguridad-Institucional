import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GradeEntity } from '../../database/entities/grade.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { UserRole } from '../../database/entities/user.entity';
import { RegisterGradeDto } from './dto/register-grade.dto';

@Injectable()
export class GradesService {
  constructor(
    @InjectRepository(GradeEntity)
    private readonly gradesRepository: Repository<GradeEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentsRepository: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachersRepository: Repository<TeacherEntity>,
    @InjectRepository(ParentEntity)
    private readonly parentsRepository: Repository<ParentEntity>
  ) {}

  async register(dto: RegisterGradeDto, userId: string, role: UserRole) {
    const student = await this.studentsRepository.findOne({ where: { id: dto.studentId } });
    if (!student) throw new NotFoundException('Estudiante no encontrado');

    await this.assertCanGradeStudent(userId, role, student);

    const maxScore = dto.maxScore ?? 100;
    if (dto.score > maxScore) {
      throw new BadRequestException('score no puede ser mayor que maxScore');
    }

    const existing = await this.gradesRepository.findOne({
      where: {
        studentId: dto.studentId,
        subject: dto.subject,
        period: dto.period,
        assessmentName: dto.assessmentName
      }
    });

    if (existing) {
      existing.score = String(dto.score);
      existing.maxScore = String(maxScore);
      existing.notes = dto.notes ?? null;
      existing.gradedBy = userId;
      existing.gradedAt = dto.gradedAt ? new Date(dto.gradedAt) : new Date();
      existing.groupId = student.groupId ?? null;
      return this.gradesRepository.save(existing);
    }

    const row = this.gradesRepository.create({
      studentId: dto.studentId,
      groupId: student.groupId ?? null,
      subject: dto.subject,
      period: dto.period,
      assessmentName: dto.assessmentName,
      score: String(dto.score),
      maxScore: String(maxScore),
      notes: dto.notes ?? null,
      gradedBy: userId,
      gradedAt: dto.gradedAt ? new Date(dto.gradedAt) : new Date()
    });
    return this.gradesRepository.save(row);
  }

  async listByStudent(
    studentId: string,
    userId: string,
    role: UserRole,
    period?: string,
    subject?: string
  ) {
    const student = await this.studentsRepository.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Estudiante no encontrado');

    await this.assertCanViewStudentGrades(userId, role, student);

    const qb = this.gradesRepository
      .createQueryBuilder('g')
      .where('g.student_id = :studentId', { studentId })
      .orderBy('g.graded_at', 'DESC');

    if (period) qb.andWhere('g.period = :period', { period });
    if (subject) qb.andWhere('g.subject = :subject', { subject });

    return qb.getMany();
  }

  async listByGroup(groupId: string, userId: string, role: UserRole, period?: string, subject?: string) {
    await this.assertCanViewGroupGrades(userId, role, groupId);

    const qb = this.gradesRepository
      .createQueryBuilder('g')
      .where('g.group_id = :groupId', { groupId })
      .orderBy('g.graded_at', 'DESC');

    if (period) qb.andWhere('g.period = :period', { period });
    if (subject) qb.andWhere('g.subject = :subject', { subject });

    return qb.getMany();
  }

  async listMyChildrenGrades(parentUserId: string, period?: string, subject?: string) {
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');

    const qb = this.gradesRepository
      .createQueryBuilder('g')
      .innerJoin('student_parents', 'sp', 'sp.student_id = g.student_id AND sp.parent_id = :pid', {
        pid: parent.id
      })
      .orderBy('g.graded_at', 'DESC');

    if (period) qb.andWhere('g.period = :period', { period });
    if (subject) qb.andWhere('g.subject = :subject', { subject });

    return qb.getMany();
  }

  async listMyStudentGrades(studentUserId: string, period?: string, subject?: string) {
    const student = await this.studentsRepository.findOne({ where: { userId: studentUserId } });
    if (!student) throw new ForbiddenException('Perfil alumno no encontrado');
    return this.listByStudent(student.id, studentUserId, UserRole.ALUMNO, period, subject);
  }

  private async assertCanGradeStudent(userId: string, role: UserRole, student: StudentEntity) {
    if (role === UserRole.ADMIN || role === UserRole.ADMINISTRATIVO) return;

    if (role !== UserRole.DOCENTE) {
      throw new ForbiddenException('Solo docente o administracion puede registrar calificaciones');
    }

    if (!student.groupId) {
      throw new BadRequestException('El estudiante no tiene grupo asignado');
    }

    await this.assertTeacherAssignedToGroup(userId, student.groupId);
  }

  private async assertCanViewStudentGrades(userId: string, role: UserRole, student: StudentEntity) {
    if (role === UserRole.ADMIN || role === UserRole.ADMINISTRATIVO) return;

    if (role === UserRole.DOCENTE) {
      if (!student.groupId) throw new ForbiddenException('Estudiante sin grupo asignado');
      await this.assertTeacherAssignedToGroup(userId, student.groupId);
      return;
    }

    if (role === UserRole.PADRE) {
      const parent = await this.parentsRepository.findOne({ where: { userId } });
      if (!parent) throw new ForbiddenException('Perfil padre no encontrado');

      const rows = await this.studentsRepository.manager.query<{ ok: boolean }[]>(
        `SELECT EXISTS (
          SELECT 1 FROM student_parents WHERE student_id = $1 AND parent_id = $2
        ) AS ok`,
        [student.id, parent.id]
      );
      if (!rows[0]?.ok) {
        throw new ForbiddenException('No tienes relacion con este estudiante');
      }
      return;
    }

    if (role === UserRole.ALUMNO) {
      if (student.userId !== userId) {
        throw new ForbiddenException('Solo puedes consultar tus propias calificaciones');
      }
      return;
    }

    throw new ForbiddenException('No autorizado');
  }

  private async assertCanViewGroupGrades(userId: string, role: UserRole, groupId: string) {
    if (role === UserRole.ADMIN || role === UserRole.ADMINISTRATIVO) return;

    if (role !== UserRole.DOCENTE) {
      throw new ForbiddenException('No autorizado a listar calificaciones por grupo');
    }

    await this.assertTeacherAssignedToGroup(userId, groupId);
  }

  private async assertTeacherAssignedToGroup(userId: string, groupId: string) {
    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');

    const rows = await this.studentsRepository.manager.query<{ ok: boolean }[]>(
      `SELECT EXISTS (
        SELECT 1 FROM teacher_groups WHERE teacher_id = $1 AND group_id = $2
      ) AS ok`,
      [teacher.id, groupId]
    );

    if (!rows[0]?.ok) {
      throw new ForbiddenException('No tienes asignacion en este grupo');
    }
  }
}