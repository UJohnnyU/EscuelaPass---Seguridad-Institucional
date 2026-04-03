import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceRecordEntity } from '../../database/entities/attendance-record.entity';
import { GradeEntity } from '../../database/entities/grade.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { UserRole } from '../../database/entities/user.entity';
import { SchoolCalendarService } from '../school-calendar/school-calendar.service';

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(headers: string[], rows: Record<string, string | number | null | undefined>[]) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }
  return '\uFEFF' + lines.join('\r\n');
}

@Injectable()
export class ExportsService {
  constructor(
    @InjectRepository(AttendanceRecordEntity)
    private readonly attendanceRepository: Repository<AttendanceRecordEntity>,
    @InjectRepository(GradeEntity)
    private readonly gradesRepository: Repository<GradeEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachersRepository: Repository<TeacherEntity>,
    private readonly schoolCalendarService: SchoolCalendarService
  ) {}

  async exportAttendanceCsv(groupId: string, userId: string, role: UserRole, dateStr?: string) {
    const date = dateStr?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    await this.assertCanViewGroup(userId, role, groupId);

    const cal = await this.schoolCalendarService.getNonInstructionalForGroupDate(date, groupId);
    if (cal.nonInstructional) {
      throw new BadRequestException(
        'La fecha está marcada como día sin clases; no aplica exportación de asistencia para ese día.'
      );
    }

    const raw = await this.attendanceRepository
      .createQueryBuilder('a')
      .innerJoin(StudentEntity, 's', 's.id = a.studentId')
      .innerJoin(UserEntity, 'u', 'u.id = s.userId')
      .select([
        's.matricula AS matricula',
        'u.fullName AS full_name',
        'a.attendanceDate AS attendance_date',
        'a.status AS status',
        'a.notes AS notes'
      ])
      .where('s.groupId = :gid', { gid: groupId })
      .andWhere('a.attendanceDate = :d', { d: date })
      .orderBy('u.fullName', 'ASC')
      .getRawMany();

    const headers = ['matricula', 'full_name', 'attendance_date', 'status', 'notes'];
    const rows = raw.map((r) => ({
      matricula: r.matricula,
      full_name: r.full_name,
      attendance_date: r.attendance_date,
      status: r.status,
      notes: r.notes
    }));
    return rowsToCsv(headers, rows);
  }

  async exportGradesCsv(groupId: string, userId: string, role: UserRole, period?: string, subject?: string) {
    await this.assertCanViewGroup(userId, role, groupId);

    const qb = this.gradesRepository
      .createQueryBuilder('g')
      .innerJoin(StudentEntity, 's', 's.id = g.studentId')
      .innerJoin(UserEntity, 'u', 'u.id = s.userId')
      .select([
        's.matricula AS matricula',
        'u.fullName AS full_name',
        'g.subject AS subject',
        'g.period AS period',
        'g.assessmentName AS assessment_name',
        'g.score AS score',
        'g.maxScore AS max_score',
        'g.notes AS notes',
        'g.gradedAt AS graded_at'
      ])
      .where('g.groupId = :gid', { gid: groupId })
      .orderBy('u.fullName', 'ASC')
      .addOrderBy('g.gradedAt', 'DESC');

    if (period) qb.andWhere('g.period = :period', { period });
    if (subject) qb.andWhere('g.subject = :subject', { subject });

    const raw = await qb.getRawMany();
    const headers = [
      'matricula',
      'full_name',
      'subject',
      'period',
      'assessment_name',
      'score',
      'max_score',
      'notes',
      'graded_at'
    ];
    const rows = raw.map((r) => ({
      matricula: r.matricula,
      full_name: r.full_name,
      subject: r.subject,
      period: r.period,
      assessment_name: r.assessment_name,
      score: r.score,
      max_score: r.max_score,
      notes: r.notes,
      graded_at: r.graded_at ? new Date(r.graded_at).toISOString() : ''
    }));
    return rowsToCsv(headers, rows);
  }

  private async assertCanViewGroup(userId: string, role: UserRole, groupId: string) {
    if (role === UserRole.ADMIN || role === UserRole.ADMINISTRATIVO) return;
    if (role !== UserRole.DOCENTE) {
      throw new ForbiddenException('No autorizado a exportar datos de este grupo');
    }

    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');

    const rows = await this.teachersRepository.manager.query<{ ok: boolean }[]>(
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
