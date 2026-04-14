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

function todayLocalISODate(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, '0');
  const d = String(n.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

@Injectable()
export class AttendanceService {
  private justificationColumnKnown = false;
  private justificationColumnExists = false;

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

  /** Evita error 500 si la BD aún no tiene la migración de is_justified. */
  private async hasJustificationColumn(): Promise<boolean> {
    if (this.justificationColumnKnown) return this.justificationColumnExists;
    const rows = await this.studentsRepository.manager.query<{ exists: boolean }[]>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'attendance_records'
          AND column_name = 'is_justified'
      ) AS exists`
    );
    this.justificationColumnExists = Boolean(rows[0]?.exists);
    this.justificationColumnKnown = true;
    return this.justificationColumnExists;
  }

  private async setJustificationForRecord(recordId: string, status: string, isJustified?: boolean) {
    if (!(await this.hasJustificationColumn())) return;
    const value = status === 'AUSENTE' ? (isJustified ?? false) : null;
    await this.attendanceRepository.query(
      `UPDATE attendance_records SET is_justified = $1 WHERE id = $2`,
      [value, recordId]
    );
  }

  async register(dto: RegisterAttendanceDto, registeredByUserId: string, role: UserRole) {
    const student = await this.studentsRepository.findOne({ where: { id: dto.studentId } });
    if (!student) throw new NotFoundException('Estudiante no encontrado');

    const dateStr = dto.attendanceDate?.slice(0, 10) ?? todayLocalISODate();
    const today = todayLocalISODate();
    if (role === UserRole.DOCENTE && dateStr !== today) {
      throw new ForbiddenException('El docente solo puede modificar asistencias del día actual');
    }

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
      const saved = await this.attendanceRepository.save(existing);
      await this.setJustificationForRecord(saved.id, dto.status, dto.isJustified);
      return saved;
    }

    const row = this.attendanceRepository.create({
      studentId: student.id,
      groupId: student.groupId ?? null,
      attendanceDate: dateStr,
      status: dto.status,
      notes: dto.notes ?? null,
      registeredBy: registeredByUserId
    });
    const saved = await this.attendanceRepository.save(row);
    await this.setJustificationForRecord(saved.id, dto.status, dto.isJustified);
    return saved;
  }

  async listByGroup(groupId: string, dateStr: string | undefined, userId: string, role: UserRole) {
    const date = dateStr?.slice(0, 10) ?? todayLocalISODate();
    await this.assertCanViewGroup(userId, role, groupId);

    const cal = await this.schoolCalendarService.getNonInstructionalForGroupDate(date, groupId);
    const hasJ = await this.hasJustificationColumn();
    const justExpr = hasJ ? 'a.is_justified' : 'NULL::boolean';
    const records = await this.attendanceRepository.query<
      {
        id: string;
        studentId: string;
        groupId: string | null;
        attendanceDate: string;
        status: string;
        isJustified: boolean | null;
        notes: string | null;
        registeredBy: string | null;
        createdAt: string;
        updatedAt: string;
      }[]
    >(
      `SELECT a.id,
              a.student_id AS "studentId",
              a.group_id AS "groupId",
              a.attendance_date AS "attendanceDate",
              a.status::text AS status,
              (${justExpr}) AS "isJustified",
              a.notes,
              a.registered_by AS "registeredBy",
              a.created_at AS "createdAt",
              a.updated_at AS "updatedAt"
       FROM attendance_records a
       INNER JOIN students s ON s.id = a.student_id
       WHERE s.group_id = $1 AND a.attendance_date = $2
       ORDER BY a.created_at ASC`,
      [groupId, date]
    );

    const students = await this.studentsRepository.manager.query<
      { studentId: string; matricula: string; fullName: string }[]
    >(
      `SELECT s.id AS "studentId", s.matricula, u.full_name AS "fullName"
       FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE s.group_id = $1
       ORDER BY u.full_name ASC`,
      [groupId]
    );

    return {
      date,
      canEdit: role !== UserRole.DOCENTE || date === todayLocalISODate(),
      nonInstructionalDay: cal.nonInstructional,
      reasons: cal.reasons.length ? cal.reasons : undefined,
      records,
      students
    };
  }

  async listMyChildrenAttendance(parentUserId: string, dateStr: string | undefined) {
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');

    const date = dateStr?.slice(0, 10) ?? todayLocalISODate();

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
