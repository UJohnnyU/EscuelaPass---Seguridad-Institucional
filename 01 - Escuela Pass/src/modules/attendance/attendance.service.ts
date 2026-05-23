/*
Escuela Pass — Proprietary Software License
Copyright (c) 2026 Murillo Martínez Jhon Kevin. All Rights Reserved.

NOTICE: This software and associated documentation files (the "Software")
constitute proprietary intellectual property. Unauthorized use is prohibited.

1. GRANT OF RIGHTS
   No license is granted to any person or entity except as expressly set
   forth in a separate written agreement signed by the copyright holder.

2. RESTRICTIONS
   Without prior written permission from the copyright holder, you may NOT:
   (a) copy, modify, adapt, translate, or create derivative works of the Software;
   (b) reverse engineer, decompile, or disassemble the Software, except as
       permitted by applicable law;
   (c) distribute, sublicense, lease, rent, sell, or otherwise transfer the
       Software or any portion thereof;
   (d) use the Software for commercial purposes, including offering it as a
       hosted service to third parties;
   (e) remove or alter any proprietary notices, labels, or marks.

3. THIRD-PARTY COMPONENTS
   The Software may include or depend on third-party open-source components
   licensed under their own terms (see package manifests and NOTICE files).
   Those components remain governed by their respective licenses. This license
   applies only to the original work of the copyright holder.

4. ACADEMIC REPOSITORY (POLI JIC)
   A non-exclusive, royalty-free, limited license is granted to Politécnico
   Colombiano Jaime Isaza Cadavid solely to archive, reproduce, and make
   available the version of the Software submitted as part of the author's
   degree thesis for academic, educational, and non-commercial public
   consultation purposes, in accordance with institutional publication
   authorization. This does not grant commercial exploitation rights to
   the institution or to third parties.

5. NO WARRANTY
   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL
   THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY.

6. GOVERNING LAW
   This license shall be governed by the laws of the Republic of Colombia,
   without regard to conflict-of-law principles.

7. CONTACT
   For licensing inquiries: jhonkevinmurillom@gmail.com

---

Resumen en español:
Software propietario de Murillo Martínez Jhon Kevin (2026). Queda prohibida la
copia, modificación, distribución o explotación comercial sin autorización
escrita. El POLI JIC cuenta con autorización limitada, no exclusiva y sin
fines de lucro, para archivo y consulta académica de la versión entregada
como Trabajo de Grado. Los componentes de terceros se rigen por sus propias
licencias.
*/

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AttendanceRecordEntity, AttendanceStatus } from '../../database/entities/attendance-record.entity';
import { ClassSessionEntity } from '../../database/entities/class-session.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentEntity, StudentLifecycleStatus } from '../../database/entities/student.entity';
import { TeacherEntity, TeacherLifecycleStatus } from '../../database/entities/teacher.entity';
import { UserRole } from '../../database/entities/user.entity';
import { RegisterAttendanceDto } from './dto/register-attendance.dto';
import { RegisterBulkAttendanceDto } from './dto/register-bulk-attendance.dto';
import { AuditService } from '../audit/audit.service';
import { SchoolCalendarService } from '../school-calendar/school-calendar.service';
import { todayLocalISODate } from '../../common/local-date';

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
  private readonly logger = new Logger(AttendanceService.name);
  private justificationColumnKnown = false;
  private justificationColumnExists = false;

  constructor(
    @InjectRepository(AttendanceRecordEntity)
    private readonly attendanceRepository: Repository<AttendanceRecordEntity>,
    @InjectRepository(ClassSessionEntity)
    private readonly classSessionsRepository: Repository<ClassSessionEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentsRepository: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachersRepository: Repository<TeacherEntity>,
    @InjectRepository(ParentEntity)
    private readonly parentsRepository: Repository<ParentEntity>,
    private readonly schoolCalendarService: SchoolCalendarService,
    private readonly auditService: AuditService
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

  /** Tras ausencias automáticas al cierre de jornada. */
  async applyUnjustifiedAbsentForRecordIds(recordIds: string[]): Promise<void> {
    if (recordIds.length === 0) return;
    if (!(await this.hasJustificationColumn())) return;
    await this.attendanceRepository.query(
      `UPDATE attendance_records SET is_justified = $2 WHERE id = ANY($1::uuid[]) AND status = 'AUSENTE'`,
      [recordIds, false]
    );
  }

  async register(dto: RegisterAttendanceDto, registeredByUserId: string, role: UserRole) {
    const student = await this.studentsRepository.findOne({ where: { id: dto.studentId } });
    if (!student) throw new NotFoundException('Estudiante no encontrado');
    if (student.lifecycleStatus !== StudentLifecycleStatus.ACTIVO) {
      throw new BadRequestException('Solo puede registrar asistencia de estudiantes en estado ACTIVO');
    }

    const dateStr = dto.attendanceDate?.slice(0, 10) ?? todayLocalISODate();
    const today = todayLocalISODate();
    if (
      (role === UserRole.DOCENTE || role === UserRole.ADMINISTRATIVO) &&
      dateStr !== today
    ) {
      throw new ForbiddenException(
        'Solo puede modificar asistencias del día actual (no días anteriores ni posteriores).'
      );
    }

    await this.assertCanRegisterForStudent(registeredByUserId, role, student);
    const classSessionId = await this.validateClassSessionForAttendance(
      student,
      dateStr,
      dto.classSessionId,
      registeredByUserId,
      role
    );
    await this.assertAcademicPeriodOpenForAttendance(
      student.schoolId,
      dateStr,
      role,
      dto.force === true,
      registeredByUserId,
      student.id
    );
    const cal = await this.schoolCalendarService.getNonInstructionalForDate(
      dateStr,
      student.groupId ?? null
    );
    this.schoolCalendarService.assertInstructionalDay(cal);

    const existing = await this.attendanceRepository.findOne({
      where: { studentId: student.id, attendanceDate: dateStr }
    });

    if (existing) {
      const previousStatus = existing.status;
      existing.status = dto.status;
      existing.notes = dto.notes ?? null;
      existing.registeredBy = registeredByUserId;
      existing.groupId = student.groupId ?? null;
      existing.classSessionId = classSessionId;
      const saved = await this.attendanceRepository.save(existing);
      await this.setJustificationForRecord(saved.id, dto.status, dto.isJustified);
      if (previousStatus !== saved.status || dto.isJustified !== undefined) {
        await this.auditService
          .log(registeredByUserId, 'attendance.daily.update', 'attendance_records', saved.id, {
            studentId: saved.studentId,
            attendanceDate: saved.attendanceDate,
            previousStatus,
            nextStatus: saved.status,
            isJustified: dto.isJustified ?? null,
            role
          })
          .catch((err) =>
            this.logger.error('No se pudo registrar auditoría de asistencia diaria', err as Error)
          );
      }
      return saved;
    }

    const row = this.attendanceRepository.create({
      studentId: student.id,
      groupId: student.groupId ?? null,
      classSessionId,
      attendanceDate: dateStr,
      status: dto.status,
      notes: dto.notes ?? null,
      registeredBy: registeredByUserId
    });
    const saved = await this.attendanceRepository.save(row);
    await this.setJustificationForRecord(saved.id, dto.status, dto.isJustified);
    return saved;
  }

  /**
   * Registra asistencia de varios alumnos en una sola petición, vinculada a una sesión académica.
   */
  async registerBulkBySession(dto: RegisterBulkAttendanceDto, registeredByUserId: string, role: UserRole) {
    const dateStr = dto.attendanceDate?.slice(0, 10) ?? todayLocalISODate();
    const today = todayLocalISODate();
    if (
      (role === UserRole.DOCENTE || role === UserRole.ADMINISTRATIVO) &&
      dateStr !== today
    ) {
      throw new ForbiddenException(
        'Solo puede modificar asistencias del día actual (no días anteriores ni posteriores).'
      );
    }

    const session = await this.classSessionsRepository.findOne({
      where: { id: dto.classSessionId.trim() }
    });
    if (!session?.isActive) {
      throw new BadRequestException('Sesion academica no encontrada o inactiva');
    }

    const [y, m, d] = dateStr.split('-').map((x) => Number.parseInt(x, 10));
    const localDay = new Date(y, m - 1, d).getDay();
    if (localDay !== session.weekday) {
      throw new BadRequestException('La fecha de asistencia no coincide con el dia de la sesion academica');
    }

    await this.assertCanRegisterForClassSession(registeredByUserId, role, session);

    const cal = await this.schoolCalendarService.getNonInstructionalForDate(dateStr, session.groupId);
    this.schoolCalendarService.assertInstructionalDay(cal);

    const studentIds = dto.entries.map((e) => e.studentId);
    const uniqueIds = [...new Set(studentIds)];
    if (uniqueIds.length !== studentIds.length) {
      throw new BadRequestException('Hay estudiantes duplicados en la lista');
    }

    const students = await this.studentsRepository.find({ where: { id: In(uniqueIds) } });
    if (students.length !== uniqueIds.length) {
      throw new NotFoundException('Uno o mas estudiantes no existen');
    }
    for (const s of students) {
      if (s.lifecycleStatus !== StudentLifecycleStatus.ACTIVO) {
        throw new BadRequestException('El registro masivo solo admite estudiantes en estado ACTIVO');
      }
      if (s.groupId !== session.groupId) {
        throw new BadRequestException('Todos los estudiantes deben pertenecer al grupo de la sesion');
      }
      await this.assertCanRegisterForStudent(registeredByUserId, role, s);
    }

    const records: AttendanceRecordEntity[] = [];
    for (const entry of dto.entries) {
      const saved = await this.register(
        {
          studentId: entry.studentId,
          status: entry.status,
          attendanceDate: dateStr,
          notes: entry.notes,
          isJustified: entry.isJustified,
          force: dto.force,
          classSessionId: dto.classSessionId
        },
        registeredByUserId,
        role
      );
      records.push(saved);
    }

    return {
      message: 'Asistencias registradas',
      classSessionId: session.id,
      attendanceDate: dateStr,
      count: records.length,
      records
    };
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
        classSessionId: string | null;
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
              a.class_session_id AS "classSessionId",
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

    const today = todayLocalISODate();
    const staffDayOnly =
      role === UserRole.DOCENTE || role === UserRole.ADMINISTRATIVO;
    return {
      view: 'day' as const,
      date,
      canEdit: !staffDayOnly || date === today,
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
        classSessionId: string | null;
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
              a.class_session_id AS "classSessionId",
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

    const groupIds = [...new Set(children.map((st) => st.groupId).filter((v): v is string => Boolean(v)))];
    const schoolIds = [...new Set(children.map((st) => st.schoolId).filter((v): v is string => Boolean(v)))];
    const flagsByGroup = new Map<string, { nonInstructional: boolean; reasons: string[] }>();
    if (groupIds.length > 0) {
      const rows = await this.studentsRepository.manager.query<
        { group_id: string | null; reason: string | null }[]
      >(
        `SELECT d.group_id, d.reason
         FROM school_non_instructional_days d
         WHERE d.exception_date = $1::date
           AND (
             d.group_id = ANY($2::uuid[])
             OR (d.group_id IS NULL AND d.school_id = ANY($3::uuid[]))
           )`,
        [date, groupIds, schoolIds.length > 0 ? schoolIds : ['00000000-0000-0000-0000-000000000000']]
      );
      for (const groupId of groupIds) {
        flagsByGroup.set(groupId, { nonInstructional: false, reasons: [] });
      }
      for (const row of rows) {
        if (!row.group_id) continue;
        const current = flagsByGroup.get(row.group_id) ?? { nonInstructional: false, reasons: [] };
        current.nonInstructional = true;
        if (row.reason?.trim()) current.reasons.push(row.reason.trim());
        flagsByGroup.set(row.group_id, current);
      }
      const globalRows = rows.filter((row) => row.group_id == null);
      if (globalRows.length > 0) {
        const globalReasons = [
          ...new Set(globalRows.map((row) => row.reason?.trim()).filter((v): v is string => Boolean(v)))
        ];
        for (const student of children) {
          if (!student.groupId || !student.schoolId) continue;
          const current = flagsByGroup.get(student.groupId) ?? { nonInstructional: false, reasons: [] };
          const appliesGlobal = schoolIds.includes(student.schoolId);
          if (!appliesGlobal) continue;
          current.nonInstructional = true;
          current.reasons = [...new Set([...current.reasons, ...globalReasons])];
          flagsByGroup.set(student.groupId, current);
        }
      }
    }
    const flags = children.map((student) => {
      if (!student.groupId) return { nonInstructional: false, reasons: [] as string[] };
      return flagsByGroup.get(student.groupId) ?? { nonInstructional: false, reasons: [] };
    });
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

    const childrenMeta = studentIds.length
      ? await this.studentsRepository.manager.query<
          {
            student_id: string;
            full_name: string;
            matricula: string;
            avatar_path: string | null;
            group_name: string | null;
            group_grade: string | null;
            group_school_year: string | null;
          }[]
        >(
          `SELECT
             st.id AS student_id,
             u.full_name,
             st.matricula,
             u.avatar_path,
             g.name AS group_name,
             g.grade AS group_grade,
             g.school_year AS group_school_year
           FROM students st
           LEFT JOIN users u ON u.id = st.user_id
           LEFT JOIN groups g ON g.id = st.group_id
           WHERE st.id = ANY($1::uuid[])`,
          [studentIds]
        )
      : [];
    const metaByStudent = new Map(childrenMeta.map((row) => [row.student_id, row]));
    const recordsByStudent = new Map<string, typeof recentRows>();
    for (const row of recentRows) {
      const bucket = recordsByStudent.get(row.studentId) ?? [];
      bucket.push(row);
      recordsByStudent.set(row.studentId, bucket);
    }

    const childrenPayload = children.map((student) => {
      const meta = metaByStudent.get(student.id);
      const recs = recordsByStudent.get(student.id) ?? [];
      const summary = {
        presente: recs.filter((r) => r.status === AttendanceStatus.PRESENTE).length,
        ausente: recs.filter((r) => r.status === AttendanceStatus.AUSENTE).length,
        retardo: recs.filter((r) => r.status === AttendanceStatus.RETARDO).length,
        total: recs.length
      };
      return {
        studentId: student.id,
        studentName: meta?.full_name ?? '',
        matricula: meta?.matricula ?? '',
        avatarUrl: meta?.avatar_path ?? null,
        group: {
          name: meta?.group_name ?? null,
          grade: meta?.group_grade ?? null,
          schoolYear: meta?.group_school_year ?? null
        },
        records: recs.map((r) => ({
          attendanceDate: r.attendanceDate,
          status: r.status,
          notes: r.notes
        })),
        summary
      };
    });

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
      existing.classSessionId = null;
      const saved = await this.attendanceRepository.save(existing);
      await this.setJustificationForRecord(saved.id, 'AUSENTE', true);
      return { message: 'Excusa registrada', id: saved.id };
    }

    const row = this.attendanceRepository.create({
      studentId: student.id,
      groupId: student.groupId ?? null,
      classSessionId: null,
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

  private async validateClassSessionForAttendance(
    student: StudentEntity,
    attendanceDate: string,
    classSessionId?: string,
    registeredByUserId?: string,
    role?: UserRole
  ): Promise<string | null> {
    if (!classSessionId?.trim()) return null;
    if (!student.groupId) {
      throw new BadRequestException('El estudiante no tiene grupo asignado para vincular sesión');
    }
    const session = await this.classSessionsRepository.findOne({ where: { id: classSessionId.trim() } });
    if (!session || !session.isActive) {
      throw new BadRequestException('Sesion academica no encontrada o inactiva');
    }
    if (session.groupId !== student.groupId) {
      throw new BadRequestException('La sesion academica no pertenece al grupo del estudiante');
    }
    const [y, m, d] = attendanceDate.split('-').map((x) => Number.parseInt(x, 10));
    const localDay = new Date(y, m - 1, d).getDay();
    if (localDay !== session.weekday) {
      throw new BadRequestException('La fecha de asistencia no coincide con el dia de la sesion academica');
    }
    if (role === UserRole.DOCENTE && registeredByUserId) {
      const teacher = await this.teachersRepository.findOne({ where: { userId: registeredByUserId } });
      if (teacher && teacher.lifecycleStatus !== TeacherLifecycleStatus.ACTIVO) {
        throw new ForbiddenException('El docente no está activo para registrar asistencia');
      }
      if (teacher && session.teacherId !== teacher.id) {
        throw new ForbiddenException('Solo el docente asignado a la sesion puede registrar esta asistencia');
      }
    }
    return session.id;
  }

  private async assertAcademicPeriodOpenForAttendance(
    schoolId: string | null,
    dateStr: string,
    role: UserRole,
    force: boolean,
    actorUserId: string,
    studentId: string
  ): Promise<void> {
    if (!schoolId) return;
    const rows = await this.studentsRepository.manager.query<
      { id: string; name: string; status: string }[]
    >(
      `SELECT id, name, status
       FROM academic_periods
       WHERE school_id = $1::uuid
         AND start_date <= $2::date
         AND end_date >= $2::date
         AND status = 'CLOSED'
       ORDER BY order_index ASC
       LIMIT 1`,
      [schoolId, dateStr]
    );
    const period = rows[0];
    if (!period) return;
    if (role === UserRole.ADMIN && force) {
      await this.auditService
        .log(actorUserId, 'attendance.force_closed_period', 'academic_periods', period.id, {
          schoolId,
          studentId,
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

  private async assertCanRegisterForClassSession(
    userId: string,
    role: UserRole,
    session: ClassSessionEntity
  ): Promise<void> {
    if (role === UserRole.ADMIN) return;
    if (role === UserRole.ADMINISTRATIVO) {
      await this.assertAdministrativeCanAccessGroup(userId, session.groupId);
      return;
    }
    if (role !== UserRole.DOCENTE) {
      throw new ForbiddenException('Solo docente o administracion puede registrar asistencia');
    }
    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');
    if (teacher.lifecycleStatus !== TeacherLifecycleStatus.ACTIVO) {
      throw new ForbiddenException('El docente no está activo para registrar asistencia');
    }
    if (session.teacherId !== teacher.id) {
      throw new ForbiddenException('Solo el docente asignado a la sesion puede usar el registro masivo');
    }
    const rows = await this.studentsRepository.manager.query<{ ok: boolean }[]>(
      `SELECT EXISTS (
        SELECT 1 FROM teacher_groups WHERE teacher_id = $1 AND group_id = $2
      ) AS ok`,
      [teacher.id, session.groupId]
    );
    if (!rows[0]?.ok) {
      throw new ForbiddenException('No tienes asignacion en el grupo de esta sesion');
    }
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
    if (teacher.lifecycleStatus !== TeacherLifecycleStatus.ACTIVO) {
      throw new ForbiddenException('El docente no está activo para consultar asistencia');
    }

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
    if (teacher.lifecycleStatus !== TeacherLifecycleStatus.ACTIVO) {
      throw new ForbiddenException('El docente no está activo para consultar asistencia');
    }
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
