import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceRecordEntity, AttendanceStatus } from '../../database/entities/attendance-record.entity';
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

const MAX_ATTENDANCE_RANGE_DAYS = 100;

function parseISODatePart(s: string): string {
  return s.slice(0, 10);
}

function countCalendarDaysInclusive(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map((x) => Number.parseInt(x, 10));
  const [ty, tm, td] = to.split('-').map((x) => Number.parseInt(x, 10));
  const a = new Date(fy, fm - 1, fd);
  const b = new Date(ty, tm - 1, td);
  return Math.round((b.getTime() - a.getTime()) / (24 * 3600 * 1000)) + 1;
}

function enumerateISODates(from: string, to: string): string[] {
  const [fy, fm, fd] = from.split('-').map((x) => Number.parseInt(x, 10));
  const [ty, tm, td] = to.split('-').map((x) => Number.parseInt(x, 10));
  const start = new Date(fy, fm - 1, fd);
  const end = new Date(ty, tm - 1, td);
  const out: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const day = String(cur.getDate()).padStart(2, '0');
    out.push(`${y}-${m}-${day}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
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

  async listByGroup(
    groupId: string,
    userId: string,
    role: UserRole,
    opts: { date?: string; from?: string; to?: string; studentId?: string }
  ) {
    await this.assertCanViewGroup(userId, role, groupId);

    const studentIdFilter = opts.studentId?.trim() || undefined;
    if (studentIdFilter) {
      const ok = await this.studentsRepository.manager.query<{ ok: boolean }[]>(
        `SELECT EXISTS (
          SELECT 1 FROM students s WHERE s.id = $1 AND s.group_id = $2
        ) AS ok`,
        [studentIdFilter, groupId]
      );
      if (!ok[0]?.ok) {
        throw new BadRequestException('El estudiante no pertenece a este grupo');
      }
    }

    const hasFrom = Boolean(opts.from?.trim());
    const hasTo = Boolean(opts.to?.trim());
    if (hasFrom !== hasTo) {
      throw new BadRequestException('Indique ambas fechas: desde y hasta');
    }

    if (hasFrom && hasTo) {
      return this.listByGroupRange(groupId, {
        from: parseISODatePart(opts.from!),
        to: parseISODatePart(opts.to!),
        studentId: studentIdFilter
      });
    }

    const date = parseISODatePart(opts.date ?? todayLocalISODate());
    const cal = await this.schoolCalendarService.getNonInstructionalForGroupDate(date, groupId);
    const hasJ = await this.hasJustificationColumn();
    const justExpr = hasJ ? 'a.is_justified' : 'NULL::boolean';

    const params: string[] = [groupId, date];
    let studentSql = '';
    if (studentIdFilter) {
      params.push(studentIdFilter);
      studentSql = ' AND s.id = $3';
    }

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
       WHERE s.group_id = $1 AND a.attendance_date = $2::date${studentSql}
       ORDER BY a.created_at ASC`,
      params
    );

    let students = await this.studentsRepository.manager.query<
      { studentId: string; matricula: string; fullName: string }[]
    >(
      studentIdFilter
        ? `SELECT s.id AS "studentId", s.matricula, u.full_name AS "fullName"
           FROM students s
           JOIN users u ON u.id = s.user_id
           WHERE s.group_id = $1 AND s.id = $2
           ORDER BY u.full_name ASC`
        : `SELECT s.id AS "studentId", s.matricula, u.full_name AS "fullName"
           FROM students s
           JOIN users u ON u.id = s.user_id
           WHERE s.group_id = $1
           ORDER BY u.full_name ASC`,
      studentIdFilter ? [groupId, studentIdFilter] : [groupId]
    );

    return {
      view: 'day' as const,
      date,
      canEdit: role !== UserRole.DOCENTE || date === todayLocalISODate(),
      nonInstructionalDay: cal.nonInstructional,
      reasons: cal.reasons.length ? cal.reasons : undefined,
      records,
      students
    };
  }

  private async listByGroupRange(
    groupId: string,
    range: { from: string; to: string; studentId?: string }
  ) {
    const from = range.from;
    const to = range.to;
    if (from > to) {
      throw new BadRequestException('La fecha inicial no puede ser posterior a la final');
    }
    const nDays = countCalendarDaysInclusive(from, to);
    if (nDays > MAX_ATTENDANCE_RANGE_DAYS) {
      throw new BadRequestException(
        `El rango máximo es ${MAX_ATTENDANCE_RANGE_DAYS} días (aprox. tres meses)`
      );
    }

    const hasJ = await this.hasJustificationColumn();
    const justExpr = hasJ ? 'a.is_justified' : 'NULL::boolean';

    const params: string[] = [groupId, from, to];
    let extra = '';
    if (range.studentId) {
      params.push(range.studentId);
      extra = ' AND s.id = $4';
    }

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
       WHERE s.group_id = $1
         AND a.attendance_date >= $2::date
         AND a.attendance_date <= $3::date${extra}
       ORDER BY a.attendance_date ASC, a.created_at ASC`,
      params
    );

    const students = await this.studentsRepository.manager.query<
      { studentId: string; matricula: string; fullName: string }[]
    >(
      range.studentId
        ? `SELECT s.id AS "studentId", s.matricula, u.full_name AS "fullName"
           FROM students s
           JOIN users u ON u.id = s.user_id
           WHERE s.group_id = $1 AND s.id = $2
           ORDER BY u.full_name ASC`
        : `SELECT s.id AS "studentId", s.matricula, u.full_name AS "fullName"
           FROM students s
           JOIN users u ON u.id = s.user_id
           WHERE s.group_id = $1
           ORDER BY u.full_name ASC`,
      range.studentId ? [groupId, range.studentId] : [groupId]
    );

    return {
      view: 'range' as const,
      dateFrom: from,
      dateTo: to,
      dates: enumerateISODates(from, to),
      canEdit: false,
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
      .leftJoinAndMapOne(
        's.user',
        'users',
        'su',
        'su.id = s.user_id'
      )
      .getMany();

    const flags = await Promise.all(
      children.map((st) =>
        this.schoolCalendarService.getNonInstructionalForDate(date, st.groupId ?? null)
      )
    );
    const nonInstructionalDay =
      children.length > 0 && flags.length > 0 && flags.every((f) => f.nonInstructional);
    const reasonsMerged = [...new Set(flags.flatMap((f) => f.reasons))];

    const studentIds = children.map((c) => c.id);
    const today = date;
    const since = new Date(today);
    since.setDate(since.getDate() - 30);
    const sinceISO = since.toISOString().slice(0, 10);

    const recentRows = studentIds.length
      ? await this.attendanceRepository
          .createQueryBuilder('a')
          .where('a.student_id IN (:...ids)', { ids: studentIds })
          .andWhere('a.attendance_date >= :s', { s: sinceISO })
          .orderBy('a.attendance_date', 'DESC')
          .getMany()
      : [];

    const childrenPayload = await Promise.all(
      children.map(async (s) => {
        const su = await this.studentsRepository.manager.query<{ full_name: string; matricula: string }[]>(
          `SELECT u.full_name, st.matricula FROM students st LEFT JOIN users u ON u.id = st.user_id WHERE st.id = $1 LIMIT 1`,
          [s.id]
        );
        const recs = recentRows.filter((r) => r.studentId === s.id);
        const summary = {
          presente: recs.filter((r) => r.status === AttendanceStatus.PRESENTE).length,
          ausente: recs.filter((r) => r.status === AttendanceStatus.AUSENTE).length,
          retardo: recs.filter((r) => r.status === AttendanceStatus.RETARDO).length,
          total: recs.length
        };
        return {
          studentId: s.id,
          studentName: su[0]?.full_name ?? '',
          matricula: su[0]?.matricula ?? '',
          records: recs.map((r) => ({
            attendanceDate: r.attendanceDate,
            status: r.status,
            notes: r.notes
          })),
          summary
        };
      })
    );

    return {
      date,
      nonInstructionalDay,
      reasons: reasonsMerged.length ? reasonsMerged : undefined,
      children: childrenPayload
    };
  }

  /**
   * Padre/tutor registra ausencia con excusa (y opcionalmente adjunta comprobante).
   * No sustituye el criterio docente; deja constancia para el grupo.
   */
  async submitParentExcuse(
    parentUserId: string,
    dto: { studentId: string; date: string; reason: string },
    excuseAttachmentPath: string | null
  ) {
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');
    const link = await this.studentsRepository.manager.query<{ ok: boolean }[]>(
      `SELECT EXISTS (SELECT 1 FROM student_parents WHERE parent_id = $1 AND student_id = $2) AS ok`,
      [parent.id, dto.studentId]
    );
    if (!link[0]?.ok) throw new ForbiddenException('No está vinculado a este estudiante');
    const student = await this.studentsRepository.findOne({ where: { id: dto.studentId } });
    if (!student) throw new NotFoundException('Estudiante no encontrado');
    const dateStr = dto.date.slice(0, 10);
    const notes = `Excusa (padre/tutor): ${dto.reason.trim()}`;

    const existing = await this.attendanceRepository.findOne({
      where: { studentId: student.id, attendanceDate: dateStr }
    });
    if (
      existing &&
      (existing.status === AttendanceStatus.PRESENTE || existing.status === AttendanceStatus.RETARDO)
    ) {
      throw new BadRequestException(
        'Ya existe registro de asistencia para ese día. Si necesita corrección, contacte a secretaría.'
      );
    }

    if (existing) {
      existing.status = AttendanceStatus.AUSENTE;
      existing.notes = notes;
      existing.registeredBy = parentUserId;
      existing.groupId = student.groupId ?? null;
      if (excuseAttachmentPath) {
        existing.excuseAttachmentPath = excuseAttachmentPath;
      }
      const saved = await this.attendanceRepository.save(existing);
      await this.setJustificationForRecord(saved.id, 'AUSENTE', true);
      return { message: 'Excusa registrada', id: saved.id };
    }

    const row = this.attendanceRepository.create({
      studentId: student.id,
      groupId: student.groupId ?? null,
      attendanceDate: dateStr,
      status: AttendanceStatus.AUSENTE,
      notes,
      registeredBy: parentUserId,
      excuseAttachmentPath: excuseAttachmentPath ?? null
    });
    const saved = await this.attendanceRepository.save(row);
    await this.setJustificationForRecord(saved.id, 'AUSENTE', true);
    return { message: 'Excusa registrada', id: saved.id };
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
    if (role === UserRole.ADMIN) return;
    if (role === UserRole.ADMINISTRATIVO) {
      await this.assertAdministrativeCanAccessGroup(userId, student.groupId);
      return;
    }
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
    if (role === UserRole.ADMIN) return;
    if (role === UserRole.ADMINISTRATIVO) {
      await this.assertAdministrativeCanAccessGroup(userId, groupId);
      return;
    }
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

  private async assertAdministrativeCanAccessGroup(userId: string, groupId: string | null): Promise<void> {
    if (!groupId) throw new ForbiddenException('No hay grupo para validar alcance institucional');
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
    if (!rows[0]?.ok) {
      throw new ForbiddenException('No tienes permisos sobre este grupo');
    }
  }
}
