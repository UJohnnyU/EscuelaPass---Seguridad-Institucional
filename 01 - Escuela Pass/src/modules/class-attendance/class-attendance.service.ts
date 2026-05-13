import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AttendanceStatus } from '../../database/entities/attendance-record.entity';
import { ClassAttendanceRecordEntity } from '../../database/entities/class-attendance-record.entity';
import { ClassSessionEntity } from '../../database/entities/class-session.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentEntity, StudentLifecycleStatus } from '../../database/entities/student.entity';
import { TeacherEntity, TeacherLifecycleStatus } from '../../database/entities/teacher.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { todayLocalISODate } from '../../common/local-date';
import { AuditService } from '../audit/audit.service';
import { SchoolCalendarService } from '../school-calendar/school-calendar.service';
import { RegisterBulkClassAttendanceDto } from './dto/register-bulk-class-attendance.dto';
import { RegisterClassAttendanceDto } from './dto/register-class-attendance.dto';

const MAX_CLASS_ATTENDANCE_RANGE_DAYS = 100;

function parseISODatePart(raw?: string): string {
  return (raw?.trim() || todayLocalISODate()).slice(0, 10);
}

function countCalendarDaysInclusive(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map((x) => Number.parseInt(x, 10));
  const [ty, tm, td] = to.split('-').map((x) => Number.parseInt(x, 10));
  const a = new Date(fy, fm - 1, fd);
  const b = new Date(ty, tm - 1, td);
  return Math.round((b.getTime() - a.getTime()) / (24 * 3600 * 1000)) + 1;
}

@Injectable()
export class ClassAttendanceService {
  private readonly logger = new Logger(ClassAttendanceService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(ClassAttendanceRecordEntity)
    private readonly recordsRepository: Repository<ClassAttendanceRecordEntity>,
    @InjectRepository(ClassSessionEntity)
    private readonly classSessionsRepository: Repository<ClassSessionEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentsRepository: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachersRepository: Repository<TeacherEntity>,
    @InjectRepository(ParentEntity)
    private readonly parentsRepository: Repository<ParentEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    private readonly schoolCalendarService: SchoolCalendarService,
    private readonly auditService: AuditService
  ) {}

  async register(dto: RegisterClassAttendanceDto, registeredByUserId: string, role: UserRole) {
    const dateStr = parseISODatePart(dto.attendanceDate);
    this.assertStaffCanEditDate(dateStr, role);

    const [student, session] = await Promise.all([
      this.studentsRepository.findOne({ where: { id: dto.studentId } }),
      this.classSessionsRepository.findOne({ where: { id: dto.classSessionId } })
    ]);

    if (!student) throw new NotFoundException('Estudiante no encontrado');
    if (!session?.isActive) throw new BadRequestException('Sesion academica no encontrada o inactiva');
    this.assertStudentCanBeMarked(student, session, dateStr);
    await this.assertCanRegisterForClassSession(registeredByUserId, role, session);
    await this.assertAcademicPeriodOpenForClassAttendance(
      session.groupId,
      dateStr,
      role,
      dto.force === true,
      registeredByUserId,
      student.id,
      session.id
    );

    const cal = await this.schoolCalendarService.getNonInstructionalForDate(dateStr, session.groupId);
    this.schoolCalendarService.assertInstructionalDay(cal);

    const existing = await this.recordsRepository.findOne({
      where: {
        studentId: student.id,
        classSessionId: session.id,
        attendanceDate: dateStr
      }
    });

    if (existing) {
      const previousStatus = existing.status;
      const previousJustified = existing.isJustified;
      existing.status = dto.status;
      existing.isJustified = dto.status === AttendanceStatus.AUSENTE ? (dto.isJustified ?? false) : false;
      existing.notes = dto.notes ?? null;
      existing.registeredBy = registeredByUserId;
      const saved = await this.recordsRepository.save(existing);
      if (previousStatus !== saved.status || previousJustified !== saved.isJustified) {
        await this.auditService
          .log(registeredByUserId, 'attendance.class.update', 'class_attendance_records', saved.id, {
            studentId: saved.studentId,
            classSessionId: saved.classSessionId,
            attendanceDate: saved.attendanceDate,
            previousStatus,
            nextStatus: saved.status,
            previousJustified,
            nextJustified: saved.isJustified
          })
          .catch((err) =>
            this.logger.error('No se pudo registrar auditoría de asistencia por clase', err as Error)
          );
      }
      return saved;
    }

    const row = this.recordsRepository.create({
      studentId: student.id,
      classSessionId: session.id,
      attendanceDate: dateStr,
      status: dto.status,
      isJustified: dto.status === AttendanceStatus.AUSENTE ? (dto.isJustified ?? false) : false,
      notes: dto.notes ?? null,
      registeredBy: registeredByUserId
    });
    return this.recordsRepository.save(row);
  }

  async registerBulk(dto: RegisterBulkClassAttendanceDto, registeredByUserId: string, role: UserRole) {
    const dateStr = parseISODatePart(dto.attendanceDate);
    this.assertStaffCanEditDate(dateStr, role);

    const session = await this.classSessionsRepository.findOne({ where: { id: dto.classSessionId.trim() } });
    if (!session?.isActive) throw new BadRequestException('Sesion academica no encontrada o inactiva');
    this.assertDateMatchesSession(dateStr, session);
    await this.assertCanRegisterForClassSession(registeredByUserId, role, session);
    await this.assertAcademicPeriodOpenForClassAttendance(
      session.groupId,
      dateStr,
      role,
      dto.force === true,
      registeredByUserId,
      null,
      session.id
    );

    const studentIds = dto.entries.map((e) => e.studentId);
    const uniqueIds = [...new Set(studentIds)];
    if (uniqueIds.length !== studentIds.length) {
      throw new BadRequestException('Hay estudiantes duplicados en la lista');
    }

    const students = await this.studentsRepository.find({ where: { id: In(uniqueIds) } });
    if (students.length !== uniqueIds.length) {
      throw new NotFoundException('Uno o mas estudiantes no existen');
    }
    for (const student of students) {
      this.assertStudentCanBeMarked(student, session, dateStr);
    }

    const cal = await this.schoolCalendarService.getNonInstructionalForDate(dateStr, session.groupId);
    this.schoolCalendarService.assertInstructionalDay(cal);

    const prepared = dto.entries.map((entry) => ({
      studentId: entry.studentId,
      status: entry.status,
      isJustified: entry.status === AttendanceStatus.AUSENTE ? (entry.isJustified ?? false) : false,
      notes: entry.notes ?? null
    }));

    const previousMap = new Map<
      string,
      {
        status: string;
        isJustified: boolean;
        notes: string | null;
      }
    >();

    const saved = await this.dataSource.transaction(async (manager) => {
      const existingRows = await manager.query<
        { studentId: string; status: string; isJustified: boolean; notes: string | null }[]
      >(
        `SELECT
            student_id AS "studentId",
            status::text AS status,
            is_justified AS "isJustified",
            notes
         FROM class_attendance_records
         WHERE class_session_id = $1::uuid
           AND attendance_date = $2::date
           AND student_id = ANY($3::uuid[])`,
        [session.id, dateStr, uniqueIds]
      );
      for (const row of existingRows) {
        previousMap.set(row.studentId, {
          status: row.status,
          isJustified: Boolean(row.isJustified),
          notes: row.notes ?? null
        });
      }

      const valuesSql: string[] = [];
      const params: Array<string | boolean | null> = [];
      for (const row of prepared) {
        const base = params.length;
        valuesSql.push(
          `($${base + 1}::uuid, $${base + 2}::uuid, $${base + 3}::date, $${base + 4}::attendance_status, $${base + 5}::boolean, $${base + 6}::text, $${base + 7}::uuid)`
        );
        params.push(
          row.studentId,
          session.id,
          dateStr,
          row.status,
          row.isJustified,
          row.notes,
          registeredByUserId
        );
      }

      return manager.query<
        {
          id: string;
          studentId: string;
          classSessionId: string;
          attendanceDate: string;
          status: AttendanceStatus;
          isJustified: boolean;
          notes: string | null;
          registeredBy: string | null;
          createdAt: string;
          updatedAt: string;
        }[]
      >(
        `INSERT INTO class_attendance_records (
            student_id,
            class_session_id,
            attendance_date,
            status,
            is_justified,
            notes,
            registered_by
         )
         VALUES ${valuesSql.join(', ')}
         ON CONFLICT (student_id, class_session_id, attendance_date)
         DO UPDATE SET
            status = EXCLUDED.status,
            is_justified = EXCLUDED.is_justified,
            notes = EXCLUDED.notes,
            registered_by = EXCLUDED.registered_by,
            updated_at = CURRENT_TIMESTAMP
         RETURNING
            id,
            student_id AS "studentId",
            class_session_id AS "classSessionId",
            attendance_date AS "attendanceDate",
            status::text AS status,
            is_justified AS "isJustified",
            notes,
            registered_by AS "registeredBy",
            created_at AS "createdAt",
            updated_at AS "updatedAt"`,
        params
      );
    });

    const summary = {
      created: 0,
      updated: 0,
      statusChanged: 0,
      justificationChanged: 0,
      notesChanged: 0
    };
    for (const row of saved) {
      const previous = previousMap.get(row.studentId);
      if (!previous) {
        summary.created += 1;
        continue;
      }
      summary.updated += 1;
      if (previous.status !== row.status) summary.statusChanged += 1;
      if (previous.isJustified !== Boolean(row.isJustified)) summary.justificationChanged += 1;
      if ((previous.notes ?? null) !== (row.notes ?? null)) summary.notesChanged += 1;
    }

    await this.auditService
      .log(registeredByUserId, 'attendance.class.bulk-upsert', 'class_attendance_records', session.id, {
        classSessionId: session.id,
        attendanceDate: dateStr,
        count: saved.length,
        summary
      })
      .catch((err) =>
        this.logger.error('No se pudo registrar auditoría de asistencia por clase (bulk)', err as Error)
      );

    return {
      message: 'Asistencias por clase registradas',
      classSessionId: session.id,
      attendanceDate: dateStr,
      count: saved.length,
      records: saved
    };
  }

  async listByClass(classSessionId: string, dateRaw: string | undefined, userId: string, role: UserRole) {
    const date = parseISODatePart(dateRaw);
    const session = await this.classSessionsRepository.findOne({ where: { id: classSessionId } });
    if (!session) throw new NotFoundException('Sesion academica no encontrada');
    await this.assertCanViewClassSession(userId, role, session);

    const records = await this.recordsRepository.find({
      where: { classSessionId: session.id, attendanceDate: date },
      order: { createdAt: 'ASC' }
    });
    const students = await this.studentsRepository.manager.query<
      { studentId: string; matricula: string; fullName: string }[]
    >(
      `SELECT s.id AS "studentId", s.matricula, u.full_name AS "fullName"
       FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE s.group_id = $1
       ORDER BY u.full_name ASC`,
      [session.groupId]
    );
    return { classSessionId: session.id, date, records, students };
  }

  /**
   * Devuelve asistencias por clase de TODOS los hijos del padre autenticado
   * en una sola query, agrupadas por studentId.
   * Solo el padre autenticado accede a sus propios hijos.
   */
  async listForParentChildren(
    parentUserId: string,
    range: { from?: string; to?: string }
  ): Promise<Record<string, {
    id: string;
    classSessionId: string;
    attendanceDate: string;
    status: string;
    isJustified: boolean;
    notes: string | null;
    subjectName: string | null;
    teacherName: string | null;
    startTime: string;
    endTime: string;
    weekday: number;
  }[]>> {
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) {
      return {};
    }

    const childRows = await this.studentsRepository.manager.query<{ studentId: string }[]>(
      `SELECT student_id AS "studentId" FROM student_parents WHERE parent_id = $1`,
      [parent.id]
    );

    if (childRows.length === 0) return {};

    const studentIds = childRows.map((r) => r.studentId);

    const to = parseISODatePart(range.to);
    const rawFrom = range.from ?? this.daysBefore(to, 30);
    const from = parseISODatePart(rawFrom);

    if (from > to) {
      return Object.fromEntries(studentIds.map((id) => [id, []]));
    }

    const rows = await this.recordsRepository.query<{
      id: string;
      studentId: string;
      classSessionId: string;
      attendanceDate: string;
      status: string;
      isJustified: boolean;
      notes: string | null;
      subjectName: string | null;
      teacherName: string | null;
      startTime: string;
      endTime: string;
      weekday: number;
    }[]>(
      `SELECT car.id,
              car.student_id AS "studentId",
              car.class_session_id AS "classSessionId",
              car.attendance_date AS "attendanceDate",
              car.status::text AS status,
              car.is_justified AS "isJustified",
              car.notes,
              sub.name AS "subjectName",
              tu.full_name AS "teacherName",
              cs.start_time AS "startTime",
              cs.end_time AS "endTime",
              cs.weekday
       FROM class_attendance_records car
       JOIN class_sessions cs ON cs.id = car.class_session_id
       LEFT JOIN subjects sub ON sub.id = cs.subject_id
       LEFT JOIN teachers t ON t.id = cs.teacher_id
       LEFT JOIN users tu ON tu.id = t.user_id
       WHERE car.student_id = ANY($1::uuid[])
         AND car.attendance_date >= $2::date
         AND car.attendance_date <= $3::date
       ORDER BY car.student_id, car.attendance_date DESC, cs.start_time ASC`,
      [studentIds, from, to]
    );

    const result: Record<string, typeof rows> = Object.fromEntries(studentIds.map((id) => [id, []]));
    for (const row of rows) {
      result[row.studentId]?.push(row);
    }
    return result;
  }

  async listByStudent(
    studentId: string,
    range: { from?: string; to?: string },
    userId: string,
    role: UserRole
  ) {
    const student = await this.studentsRepository.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Estudiante no encontrado');
    await this.assertCanViewStudent(userId, role, student);

    const to = parseISODatePart(range.to);
    const from = parseISODatePart(range.from ?? this.daysBefore(to, 30));
    if (from > to) throw new BadRequestException('La fecha inicial no puede ser posterior a la final');
    if (countCalendarDaysInclusive(from, to) > MAX_CLASS_ATTENDANCE_RANGE_DAYS) {
      throw new BadRequestException(`El rango maximo es ${MAX_CLASS_ATTENDANCE_RANGE_DAYS} dias`);
    }

    const rows = await this.recordsRepository.query<
      {
        id: string;
        studentId: string;
        classSessionId: string;
        attendanceDate: string;
        status: string;
        isJustified: boolean;
        notes: string | null;
        registeredBy: string | null;
        subjectName: string | null;
        teacherName: string | null;
        startTime: string;
        endTime: string;
        weekday: number;
      }[]
    >(
      `SELECT car.id,
              car.student_id AS "studentId",
              car.class_session_id AS "classSessionId",
              car.attendance_date AS "attendanceDate",
              car.status::text AS status,
              car.is_justified AS "isJustified",
              car.notes,
              car.registered_by AS "registeredBy",
              sub.name AS "subjectName",
              tu.full_name AS "teacherName",
              cs.start_time AS "startTime",
              cs.end_time AS "endTime",
              cs.weekday
       FROM class_attendance_records car
       JOIN class_sessions cs ON cs.id = car.class_session_id
       LEFT JOIN subjects sub ON sub.id = cs.subject_id
       LEFT JOIN teachers t ON t.id = cs.teacher_id
       LEFT JOIN users tu ON tu.id = t.user_id
       WHERE car.student_id = $1
         AND car.attendance_date >= $2::date
         AND car.attendance_date <= $3::date
       ORDER BY car.attendance_date DESC, cs.start_time ASC`,
      [student.id, from, to]
    );

    return { studentId: student.id, dateFrom: from, dateTo: to, records: rows };
  }

  private assertStaffCanEditDate(dateStr: string, role: UserRole) {
    if ((role === UserRole.DOCENTE || role === UserRole.ADMINISTRATIVO) && dateStr !== todayLocalISODate()) {
      throw new ForbiddenException('Solo puede modificar asistencias del dia actual');
    }
  }

  private assertStudentCanBeMarked(student: StudentEntity, session: ClassSessionEntity, dateStr: string) {
    if (student.lifecycleStatus !== StudentLifecycleStatus.ACTIVO) {
      throw new BadRequestException('Solo puede registrar asistencia de estudiantes en estado ACTIVO');
    }
    if (student.groupId !== session.groupId) {
      throw new BadRequestException('El estudiante no pertenece al grupo de la sesion');
    }
    this.assertDateMatchesSession(dateStr, session);
  }

  private assertDateMatchesSession(dateStr: string, session: ClassSessionEntity) {
    const [y, m, d] = dateStr.split('-').map((x) => Number.parseInt(x, 10));
    const localDay = new Date(y, m - 1, d).getDay();
    if (localDay !== session.weekday) {
      throw new BadRequestException('La fecha de asistencia no coincide con el dia de la sesion academica');
    }
  }

  private async assertCanRegisterForClassSession(userId: string, role: UserRole, session: ClassSessionEntity) {
    if (role === UserRole.ADMIN) return;
    if (role === UserRole.ADMINISTRATIVO) {
      await this.assertAdministrativeCanAccessGroup(userId, session.groupId);
      return;
    }
    if (role !== UserRole.DOCENTE) {
      throw new ForbiddenException('Solo docente o administracion puede registrar asistencia por clase');
    }
    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');
    if (teacher.lifecycleStatus !== TeacherLifecycleStatus.ACTIVO) {
      throw new ForbiddenException('El docente no esta activo para registrar asistencia');
    }
    if (session.teacherId !== teacher.id) {
      throw new ForbiddenException('Solo el docente asignado a la sesion puede registrar esta asistencia');
    }
  }

  private async assertAcademicPeriodOpenForClassAttendance(
    groupId: string,
    dateStr: string,
    role: UserRole,
    force: boolean,
    actorUserId: string,
    studentId: string | null,
    classSessionId: string
  ): Promise<void> {
    const rows = await this.dataSource.query<
      { id: string; name: string; school_id: string }[]
    >(
      `SELECT ap.id, ap.name, g.school_id
       FROM groups g
       INNER JOIN academic_periods ap ON ap.school_id = g.school_id
       WHERE g.id = $1::uuid
         AND ap.start_date <= $2::date
         AND ap.end_date >= $2::date
         AND ap.status = 'CLOSED'
       ORDER BY ap.order_index ASC
       LIMIT 1`,
      [groupId, dateStr]
    );
    const period = rows[0];
    if (!period) return;
    if (role === UserRole.ADMIN && force) {
      await this.auditService
        .log(actorUserId, 'attendance.force_closed_period', 'academic_periods', period.id, {
          schoolId: period.school_id,
          groupId,
          studentId,
          classSessionId,
          attendanceDate: dateStr,
          periodName: period.name
        })
        .catch((err) =>
          this.logger.error('No se pudo registrar auditoría de override de periodo cerrado', err as Error)
        );
      return;
    }
    throw new ForbiddenException('El periodo académico está cerrado. No se pueden registrar asistencias.');
  }

  private async assertCanViewClassSession(userId: string, role: UserRole, session: ClassSessionEntity) {
    if (role === UserRole.ADMIN) return;
    if (role === UserRole.ADMINISTRATIVO) {
      await this.assertAdministrativeCanAccessGroup(userId, session.groupId);
      return;
    }
    if (role !== UserRole.DOCENTE) {
      throw new ForbiddenException('No autorizado para consultar esta sesion');
    }
    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher || teacher.lifecycleStatus !== TeacherLifecycleStatus.ACTIVO) {
      throw new ForbiddenException('Perfil docente no encontrado o inactivo');
    }
    if (session.teacherId !== teacher.id) {
      throw new ForbiddenException('Solo el docente asignado puede consultar esta sesion');
    }
  }

  private async assertCanViewStudent(userId: string, role: UserRole, student: StudentEntity) {
    if (role === UserRole.ADMIN) return;
    if (role === UserRole.PADRE) {
      const parent = await this.parentsRepository.findOne({ where: { userId } });
      if (!parent) throw new ForbiddenException('Perfil padre no encontrado');
      const rows = await this.studentsRepository.manager.query<{ ok: boolean }[]>(
        `SELECT EXISTS (
          SELECT 1 FROM student_parents WHERE parent_id = $1 AND student_id = $2
        ) AS ok`,
        [parent.id, student.id]
      );
      if (!rows[0]?.ok) throw new ForbiddenException('No esta vinculado a este estudiante');
      return;
    }
    if (role === UserRole.ADMINISTRATIVO) {
      await this.assertAdministrativeCanAccessGroup(userId, student.groupId);
      return;
    }
    if (role === UserRole.DOCENTE) {
      const teacher = await this.teachersRepository.findOne({ where: { userId } });
      if (!teacher || teacher.lifecycleStatus !== TeacherLifecycleStatus.ACTIVO) {
        throw new ForbiddenException('Perfil docente no encontrado o inactivo');
      }
      const rows = await this.studentsRepository.manager.query<{ ok: boolean }[]>(
        `SELECT EXISTS (
          SELECT 1 FROM teacher_groups WHERE teacher_id = $1 AND group_id = $2
        ) AS ok`,
        [teacher.id, student.groupId]
      );
      if (!rows[0]?.ok) throw new ForbiddenException('No tienes asignacion en el grupo de este estudiante');
      return;
    }
    throw new ForbiddenException('No autorizado para consultar asistencia por clase');
  }

  private async assertAdministrativeCanAccessGroup(userId: string, groupId: string | null) {
    if (!groupId) throw new ForbiddenException('No hay grupo para validar alcance institucional');
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user?.schoolId || user.role !== UserRole.ADMINISTRATIVO) {
      throw new ForbiddenException('Usuario administrativo invalido');
    }
    const rows = await this.studentsRepository.manager.query<{ ok: boolean }[]>(
      `SELECT EXISTS (
        SELECT 1 FROM groups g WHERE g.id = $1 AND g.school_id = $2
      ) AS ok`,
      [groupId, user.schoolId]
    );
    if (!rows[0]?.ok) throw new ForbiddenException('No tienes permisos sobre este grupo');
  }

  private daysBefore(to: string, days: number): string {
    const [y, m, d] = to.split('-').map((x) => Number.parseInt(x, 10));
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() - days);
    return date.toISOString().slice(0, 10);
  }
}
