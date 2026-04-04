import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceRecordEntity } from '../../database/entities/attendance-record.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { UserRole } from '../../database/entities/user.entity';
import { RegisterAttendanceDto } from './dto/register-attendance.dto';
import { SchoolCalendarService } from '../school-calendar/school-calendar.service';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceRecordEntity)
    private readonly attendanceRepository: Repository<AttendanceRecordEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentsRepository: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachersRepository: Repository<TeacherEntity>,
    @InjectRepository(ParentEntity)
    private readonly parentsRepository: Repository<ParentEntity>,
    private readonly schoolCalendarService: SchoolCalendarService
  ) {}

  async register(dto: RegisterAttendanceDto, registeredByUserId: string, role: UserRole) {
    const student = await this.studentsRepository.findOne({ where: { id: dto.studentId } });
    if (!student) throw new NotFoundException('Estudiante no encontrado');

    const dateStr = dto.attendanceDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);

    await this.assertCanRegisterForStudent(registeredByUserId, role, student);
    const cal = await this.schoolCalendarService.getNonInstructionalForDate(
      dateStr,
      student.groupId ?? null
    );
    this.schoolCalendarService.assertInstructionalDay(cal);

    const existing = await this.attendanceRepository.findOne({
      where: { studentId: student.id, attendanceDate: dateStr }
    });

    if (existing) {
      existing.status = dto.status;
      existing.notes = dto.notes ?? null;
      existing.registeredBy = registeredByUserId;
      existing.groupId = student.groupId ?? null;
      return this.attendanceRepository.save(existing);
    }

    const row = this.attendanceRepository.create({
      studentId: student.id,
      groupId: student.groupId ?? null,
      attendanceDate: dateStr,
      status: dto.status,
      notes: dto.notes ?? null,
      registeredBy: registeredByUserId
    });
    return this.attendanceRepository.save(row);
  }

  async listByGroup(groupId: string, dateStr: string | undefined, userId: string, role: UserRole) {
    const date = dateStr?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    await this.assertCanViewGroup(userId, role, groupId);

    const cal = await this.schoolCalendarService.getNonInstructionalForGroupDate(date, groupId);
    const records = await this.attendanceRepository
      .createQueryBuilder('a')
      .innerJoin('students', 's', 's.id = a.student_id')
      .where('s.group_id = :gid', { gid: groupId })
      .andWhere('a.attendance_date = :d', { d: date })
      .orderBy('a.created_at', 'ASC')
      .getMany();

    return {
      date,
      nonInstructionalDay: cal.nonInstructional,
      reasons: cal.reasons.length ? cal.reasons : undefined,
      records
    };
  }

  async listMyChildrenAttendance(parentUserId: string, dateStr: string | undefined) {
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');

    const date = dateStr?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);

    const children = await this.studentsRepository
      .createQueryBuilder('s')
      .innerJoin('student_parents', 'sp', 'sp.student_id = s.id AND sp.parent_id = :pid', {
        pid: parent.id
      })
      .getMany();

    const flags = await Promise.all(
      children.map((st) =>
        this.schoolCalendarService.getNonInstructionalForDate(date, st.groupId ?? null)
      )
    );
    const nonInstructionalDay =
      children.length > 0 && flags.length > 0 && flags.every((f) => f.nonInstructional);
    const reasonsMerged = [...new Set(flags.flatMap((f) => f.reasons))];

    const records = await this.attendanceRepository
      .createQueryBuilder('a')
      .innerJoin('students', 's', 's.id = a.student_id')
      .innerJoin('student_parents', 'sp', 'sp.student_id = s.id AND sp.parent_id = :pid', {
        pid: parent.id
      })
      .where('a.attendance_date = :d', { d: date })
      .orderBy('s.matricula', 'ASC')
      .getMany();

    return {
      date,
      nonInstructionalDay,
      reasons: reasonsMerged.length ? reasonsMerged : undefined,
      records
    };
  }

  /** Lista hijos vinculados al padre (para circuito, visitas, etc.). */
  async listMyStudentsForParent(parentUserId: string) {
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');

    const students = await this.studentsRepository
      .createQueryBuilder('s')
      .innerJoin('student_parents', 'sp', 'sp.student_id = s.id AND sp.parent_id = :pid', { pid: parent.id })
      .innerJoin('users', 'u', 'u.id = s.user_id')
      .select(['s.id AS id', 's.matricula AS matricula', 'u.full_name AS "fullName"'])
      .orderBy('s.matricula', 'ASC')
      .getRawMany<{ id: string; matricula: string; fullName: string }>();

    return { parentId: parent.id, students };
  }

  private async assertCanRegisterForStudent(
    userId: string,
    role: UserRole,
    student: StudentEntity
  ) {
    if (role === UserRole.ADMIN || role === UserRole.ADMINISTRATIVO) return;
    if (role !== UserRole.DOCENTE) {
      throw new ForbiddenException('Solo docente o administracion puede registrar asistencia');
    }
    if (!student.groupId) {
      throw new BadRequestException('El estudiante no tiene grupo asignado');
    }
    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');

    const rows = await this.studentsRepository.manager.query<{ ok: boolean }[]>(
      `SELECT EXISTS (
        SELECT 1 FROM teacher_groups WHERE teacher_id = $1 AND group_id = $2
      ) AS ok`,
      [teacher.id, student.groupId]
    );
    if (!rows[0]?.ok) {
      throw new ForbiddenException('No tienes asignacion en el grupo de este estudiante');
    }
  }

  private async assertCanViewGroup(userId: string, role: UserRole, groupId: string) {
    if (role === UserRole.ADMIN || role === UserRole.ADMINISTRATIVO) return;
    if (role !== UserRole.DOCENTE) {
      throw new ForbiddenException('No autorizado a listar este grupo');
    }
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
