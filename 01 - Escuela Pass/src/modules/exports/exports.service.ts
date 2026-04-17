import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import { Repository } from 'typeorm';
import { AttendanceRecordEntity } from '../../database/entities/attendance-record.entity';
import { GroupEntity } from '../../database/entities/group.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { InstitutionProfile, SettingsService } from '../settings/settings.service';
import { SchoolCalendarService } from '../school-calendar/school-calendar.service';

type AttendanceExportRow = {
  matricula: string;
  full_name: string;
  attendance_date: string;
  status: string;
  notes: string | null;
};

type GradesExportRow = {
  matricula: string;
  full_name: string;
  subject: string;
  period: string;
  assessment_name: string;
  score: string | number;
  max_score: string | number;
  notes: string | null;
  graded_at: string;
};

type SheetBranding = {
  institution: InstitutionProfile;
  reportTitle: string;
  subtitle?: string;
};

@Injectable()
export class ExportsService {
  constructor(
    @InjectRepository(AttendanceRecordEntity)
    private readonly attendanceRepository: Repository<AttendanceRecordEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachersRepository: Repository<TeacherEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupsRepository: Repository<GroupEntity>,
    private readonly schoolCalendarService: SchoolCalendarService,
    private readonly settingsService: SettingsService
  ) {}

  async exportAttendanceXlsx(groupId: string, userId: string, role: UserRole, dateStr?: string) {
    const { headers, rows, date } = await this.loadAttendanceExport(groupId, userId, role, dateStr);
    const groupRow = await this.groupsRepository.findOne({ where: { id: groupId } });
    const institution = await this.settingsService.getInstitutionProfileForSchoolId(groupRow?.schoolId ?? null);
    const buffer = await this.buildXlsxBuffer(headers, rows as Record<string, string | number | null | undefined>[], 'Asistencia', {
      institution,
      reportTitle: 'Reporte de asistencia',
      subtitle: `Fecha: ${date}`
    });
    return { buffer, filename: `asistencia-${date}.xlsx` };
  }

  async exportGradesXlsx(
    groupId: string,
    userId: string,
    role: UserRole,
    period?: string,
    subject?: string
  ) {
    const { headers, rows } = await this.loadGradesExport(groupId, userId, role, period, subject);
    const groupRow = await this.groupsRepository.findOne({ where: { id: groupId } });
    const institution = await this.settingsService.getInstitutionProfileForSchoolId(groupRow?.schoolId ?? null);
    const suffix = [period, subject].filter(Boolean).join(' · ') || 'Todos los períodos / materias';
    const buffer = await this.buildXlsxBuffer(
      headers,
      rows as Record<string, string | number | null | undefined>[],
      'Calificaciones',
      {
        institution,
        reportTitle: 'Reporte de calificaciones',
        subtitle: suffix
      }
    );
    const safe = [period, subject].filter(Boolean).join('_') || 'todos';
    const fileSafe = safe.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    return { buffer, filename: `calificaciones-${fileSafe || 'todos'}.xlsx` };
  }

  /** Todas las calificaciones del grupo (misma estructura que el reporte plano), con cabecera institucional. */
  async exportBulletinConsolidatedXlsx(
    groupId: string,
    userId: string,
    role: UserRole,
    period?: string,
    subject?: string
  ) {
    const group = await this.groupsRepository.findOne({ where: { id: groupId } });
    if (!group) throw new BadRequestException('Grupo no encontrado');

    const { headers, rows } = await this.loadGradesExport(groupId, userId, role, period, subject);
    const institution = await this.settingsService.getInstitutionProfileForSchoolId(group.schoolId);
    const buffer = await this.buildXlsxBuffer(
      headers,
      rows as Record<string, string | number | null | undefined>[],
      'Boletín consolidado',
      {
        institution,
        reportTitle: 'Boletín consolidado de calificaciones',
        subtitle: `Grupo: ${group.name} · Año escolar: ${group.schoolYear} · Turno: ${group.shift}${
          group.grade ? ` · Grado: ${group.grade}` : ''
        }`
      }
    );
    const p = period ? period.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 40) : 'todos';
    return { buffer, filename: `boletin-consolidado-${group.name}-${p}.xlsx` };
  }

  private async loadAttendanceExport(
    groupId: string,
    userId: string,
    role: UserRole,
    dateStr?: string
  ): Promise<{
    date: string;
    headers: string[];
    rows: AttendanceExportRow[];
  }> {
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
      .innerJoin(StudentEntity, 's', 's.id = a.student_id')
      .innerJoin(UserEntity, 'u', 'u.id = s.user_id')
      .select([
        's.matricula AS matricula',
        'u.full_name AS full_name',
        'a.attendance_date AS attendance_date',
        'a.status AS status',
        'a.notes AS notes'
      ])
      .where('s.group_id = :gid', { gid: groupId })
      .andWhere('a.attendance_date = :d', { d: date })
      .orderBy('u.full_name', 'ASC')
      .getRawMany();

    const headers = ['matricula', 'full_name', 'attendance_date', 'status', 'notes'];
    const rows = raw.map((r) => ({
      matricula: r.matricula,
      full_name: r.full_name,
      attendance_date: r.attendance_date,
      status: r.status,
      notes: r.notes
    }));
    return { date, headers, rows };
  }

  private async loadGradesExport(
    groupId: string,
    userId: string,
    role: UserRole,
    period?: string,
    subject?: string
  ): Promise<{ headers: string[]; rows: GradesExportRow[] }> {
    await this.assertCanViewGroup(userId, role, groupId);

    const params: unknown[] = [groupId];
    const wheres: string[] = ['a.group_id = $1'];
    if (period) {
      params.push(period);
      wheres.push(`a.period = $${params.length}`);
    }
    if (subject) {
      params.push(subject);
      wheres.push(`a.subject_name = $${params.length}`);
    }

    const raw = await this.groupsRepository.manager.query<
      {
        matricula: string;
        full_name: string;
        subject: string;
        period: string;
        assessment_name: string;
        score: string | null;
        max_score: string;
        notes: string | null;
        graded_at: Date | null;
      }[]
    >(
      `SELECT
         s.matricula AS matricula,
         u.full_name AS full_name,
         a.subject_name AS subject,
         a.period AS period,
         a.title AS assessment_name,
         ag.score::text AS score,
         a.max_score::text AS max_score,
         ag.notes AS notes,
         ag.graded_at AS graded_at
       FROM activities a
       INNER JOIN students s ON s.group_id = a.group_id
       INNER JOIN users u ON u.id = s.user_id
       LEFT JOIN activity_grades ag ON ag.activity_id = a.id AND ag.student_id = s.id
       WHERE ${wheres.join(' AND ')} AND a.published_at IS NOT NULL
       ORDER BY u.full_name ASC, a.subject_name ASC, ag.graded_at DESC`,
      params
    );

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
      score: r.score ?? '',
      max_score: r.max_score,
      notes: r.notes,
      graded_at: r.graded_at ? new Date(r.graded_at).toISOString() : ''
    }));
    return { headers, rows };
  }

  private async buildXlsxBuffer(
    headers: string[],
    rows: Record<string, string | number | null | undefined>[],
    sheetName: string,
    branding?: SheetBranding
  ): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(sheetName, {
      views: [{ state: 'frozen', ySplit: branding ? 4 : 1 }]
    });

    let headerRowIndex = 1;
    if (branding) {
      ws.mergeCells(1, 1, 1, Math.max(headers.length, 1));
      const c1 = ws.getCell(1, 1);
      c1.value = branding.institution.name;
      c1.font = { bold: true, size: 14 };
      c1.alignment = { horizontal: 'center', vertical: 'middle' };

      ws.mergeCells(2, 1, 2, Math.max(headers.length, 1));
      const c2 = ws.getCell(2, 1);
      c2.value = branding.reportTitle;
      c2.font = { bold: true, size: 12 };
      c2.alignment = { horizontal: 'center' };

      ws.mergeCells(3, 1, 3, Math.max(headers.length, 1));
      const c3 = ws.getCell(3, 1);
      c3.value = branding.subtitle ?? '';
      c3.font = { size: 10, color: { argb: 'FF444444' } };
      c3.alignment = { horizontal: 'center', wrapText: true };

      headerRowIndex = 4;
    }

    const hr = ws.getRow(headerRowIndex);
    headers.forEach((h, i) => {
      hr.getCell(i + 1).value = h;
    });
    hr.font = { bold: true };
    hr.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8EEF5' }
    };

    for (const row of rows) {
      ws.addRow(headers.map((h) => row[h]));
    }

    for (let c = 1; c <= headers.length; c++) {
      let max = 12;
      for (let r = headerRowIndex; r <= ws.rowCount; r++) {
        const cell = ws.getCell(r, c);
        const v = cell.value != null ? String(cell.value) : '';
        if (v.length > max) max = Math.min(v.length, 55);
      }
      ws.getColumn(c).width = max + 2;
    }

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  private async assertCanViewGroup(userId: string, role: UserRole, groupId: string) {
    if (role === UserRole.ADMIN) return;
    if (role === UserRole.ADMINISTRATIVO) {
      const rows = await this.attendanceRepository.manager.query<{ ok: boolean }[]>(
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
      if (!rows[0]?.ok) throw new ForbiddenException('No autorizado a exportar datos de este grupo');
      return;
    }
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
