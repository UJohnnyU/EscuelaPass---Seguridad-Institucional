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

import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import { readFileSync } from 'fs';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { AttendanceRecordEntity } from '../../database/entities/attendance-record.entity';
import { GroupEntity } from '../../database/entities/group.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity, TeacherLifecycleStatus } from '../../database/entities/teacher.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { resolveUploadFile } from '../../lib/uploads-path';
import { InstitutionProfile, SettingsService } from '../settings/settings.service';
import { SchoolCalendarService } from '../school-calendar/school-calendar.service';

type AttendanceExportRow = {
  matricula: string;
  full_name: string;
  attendance_date: string;
  status: string;
  notes: string | null;
};

type ClassAttendanceExportRow = AttendanceExportRow & {
  subject: string;
  teacher: string;
  class_time: string;
  is_justified: string;
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

  private static readonly EXPORT_HEADER_LABELS: Record<string, string> = {
    matricula: 'Matrícula',
    full_name: 'Nombre del estudiante',
    attendance_date: 'Día',
    status: 'Estado',
    notes: 'Observaciones',
    teacher: 'Docente',
    class_time: 'Horario',
    is_justified: 'Justificada',
    subject: 'Asignatura',
    period: 'Período académico',
    assessment_name: 'Actividad o instrumento',
    score: 'Calificación',
    max_score: 'Puntaje máximo',
    graded_at: 'Fecha y hora de registro'
  };

  /** Fecha corta legible (sin ISO 8601 en celdas). */
  private formatExportDateOnly(value: unknown): string {
    if (value == null || value === '') return '';
    if (value instanceof Date) {
      if (!Number.isFinite(value.getTime())) return '';
      return value.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    const s = String(value).trim();
    const d = new Date(s.includes('T') ? s : `${s}T12:00:00`);
    if (!Number.isFinite(d.getTime())) return s;
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  private formatExportDateTime(value: unknown): string {
    if (value == null || value === '') return '';
    const d = value instanceof Date ? value : new Date(String(value));
    if (!Number.isFinite(d.getTime())) return String(value);
    return d.toLocaleString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private attendanceStatusLabel(status: string): string {
    const v = String(status ?? '').trim().toUpperCase();
    if (v === 'PRESENTE') return 'Presente';
    if (v === 'AUSENTE') return 'Ausente';
    if (v === 'TARDE') return 'Tarde';
    if (v === 'JUSTIFICADO') return 'Justificado';
    return status;
  }

  private shiftLabel(shift: string): string {
    if (shift === 'MATUTINO') return 'Mañana';
    if (shift === 'VESPERTINO') return 'Tarde';
    if (shift === 'NOCTURNO') return 'Noche';
    return shift;
  }

  async exportAttendanceXlsx(groupId: string, userId: string, role: UserRole, dateStr?: string) {
    const date = dateStr?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    await this.assertCanViewGroup(userId, role, groupId);
    const cal = await this.schoolCalendarService.getNonInstructionalForGroupDate(date, groupId);
    if (cal.nonInstructional) {
      throw new BadRequestException(
        'La fecha está marcada como día sin clases; no aplica exportación de asistencia para ese día.'
      );
    }
    const groupRow = await this.groupsRepository.findOne({ where: { id: groupId } });
    const institution = await this.settingsService.getInstitutionProfileForSchoolId(groupRow?.schoolId ?? null);
    const filename = `asistencia-${date}.xlsx`;
    const filePath = await this.buildAttendanceXlsxTempFile(groupId, date, {
      institution,
      reportTitle: 'Reporte de asistencia',
      subtitle: `Día: ${this.formatExportDateOnly(`${date}T12:00:00`)}`
    });
    return { filePath, filename };
  }

  async exportClassAttendanceXlsx(groupId: string, userId: string, role: UserRole, dateStr?: string) {
    const { headers, rows, date } = await this.loadClassAttendanceExport(groupId, userId, role, dateStr);
    const groupRow = await this.groupsRepository.findOne({ where: { id: groupId } });
    const institution = await this.settingsService.getInstitutionProfileForSchoolId(groupRow?.schoolId ?? null);
    const buffer = await this.buildXlsxBuffer(
      headers,
      rows as Record<string, string | number | null | undefined>[],
      'Asistencia por clase',
      {
        institution,
        reportTitle: 'Reporte de asistencia por clase',
        subtitle: `Día: ${this.formatExportDateOnly(`${date}T12:00:00`)}`
      }
    );
    return { buffer, filename: `asistencia-por-clase-${date}.xlsx` };
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
        subtitle: `Grupo: ${group.name} · Año escolar: ${group.schoolYear} · Turno: ${this.shiftLabel(group.shift)}${
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
      attendance_date: this.formatExportDateOnly(r.attendance_date),
      status: this.attendanceStatusLabel(r.status),
      notes: r.notes
    }));
    return { date, headers, rows };
  }

  private async buildAttendanceXlsxTempFile(
    groupId: string,
    date: string,
    branding: SheetBranding
  ): Promise<string> {
    const tempPath = join(tmpdir(), `escuela-pass-attendance-${randomUUID()}.xlsx`);
    const wb = new ExcelJS.stream.xlsx.WorkbookWriter({
      filename: tempPath,
      useStyles: true
    });
    const headers = ['matricula', 'full_name', 'attendance_date', 'status', 'notes'];
    const ws = wb.addWorksheet('Asistencia', {
      views: [{ state: 'frozen', ySplit: 4 }]
    });

    ws.mergeCells(1, 1, 1, headers.length);
    ws.getCell(1, 1).value = branding.institution.name;
    ws.getCell(1, 1).font = { bold: true, size: 14 };
    ws.getCell(1, 1).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.mergeCells(2, 1, 2, headers.length);
    ws.getCell(2, 1).value = branding.reportTitle;
    ws.getCell(2, 1).font = { bold: true, size: 12 };
    ws.getCell(2, 1).alignment = { horizontal: 'center' };

    ws.mergeCells(3, 1, 3, headers.length);
    ws.getCell(3, 1).value = branding.subtitle ?? '';
    ws.getCell(3, 1).font = { size: 10, color: { argb: 'FF444444' } };
    ws.getCell(3, 1).alignment = { horizontal: 'center', wrapText: true };

    const headerRow = ws.addRow(headers.map((h) => ExportsService.EXPORT_HEADER_LABELS[h] ?? h));
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8EEF5' }
    };
    headerRow.commit();

    ws.columns = [
      { width: 20 },
      { width: 34 },
      { width: 18 },
      { width: 16 },
      { width: 42 }
    ];

    const chunkSize = 1000;
    let offset = 0;
    while (true) {
      const chunk = await this.attendanceRepository.manager.query<
        { matricula: string; full_name: string; attendance_date: string; status: string; notes: string | null }[]
      >(
        `SELECT
           s.matricula,
           u.full_name,
           a.attendance_date,
           a.status::text AS status,
           a.notes
         FROM attendance_records a
         INNER JOIN students s ON s.id = a.student_id
         INNER JOIN users u ON u.id = s.user_id
         WHERE s.group_id = $1::uuid
           AND a.attendance_date = $2::date
         ORDER BY u.full_name ASC, s.id ASC
         LIMIT $3 OFFSET $4`,
        [groupId, date, chunkSize, offset]
      );
      if (chunk.length === 0) break;
      for (const row of chunk) {
        const x = ws.addRow([
          row.matricula,
          row.full_name,
          this.formatExportDateOnly(row.attendance_date),
          this.attendanceStatusLabel(row.status),
          row.notes
        ]);
        x.commit();
      }
      offset += chunk.length;
    }

    ws.commit();
    await wb.commit();
    await fs.access(tempPath);
    return tempPath;
  }

  private async loadClassAttendanceExport(
    groupId: string,
    userId: string,
    role: UserRole,
    dateStr?: string
  ): Promise<{
    date: string;
    headers: string[];
    rows: ClassAttendanceExportRow[];
  }> {
    const date = dateStr?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    await this.assertCanViewGroup(userId, role, groupId);

    const raw = await this.groupsRepository.manager.query<
      {
        matricula: string;
        full_name: string;
        attendance_date: string;
        status: string;
        notes: string | null;
        subject: string | null;
        teacher: string | null;
        start_time: string;
        end_time: string;
        is_justified: boolean;
      }[]
    >(
      `SELECT s.matricula,
              u.full_name,
              car.attendance_date,
              car.status::text AS status,
              car.notes,
              sub.name AS subject,
              tu.full_name AS teacher,
              cs.start_time,
              cs.end_time,
              car.is_justified
       FROM class_attendance_records car
       JOIN students s ON s.id = car.student_id
       JOIN users u ON u.id = s.user_id
       JOIN class_sessions cs ON cs.id = car.class_session_id
       LEFT JOIN subjects sub ON sub.id = cs.subject_id
       LEFT JOIN teachers t ON t.id = cs.teacher_id
       LEFT JOIN users tu ON tu.id = t.user_id
       WHERE s.group_id = $1
         AND car.attendance_date = $2::date
       ORDER BY cs.start_time ASC, u.full_name ASC`,
      [groupId, date]
    );

    const headers = [
      'matricula',
      'full_name',
      'attendance_date',
      'subject',
      'teacher',
      'class_time',
      'status',
      'is_justified',
      'notes'
    ];
    const rows = raw.map((r) => ({
      matricula: r.matricula,
      full_name: r.full_name,
      attendance_date: this.formatExportDateOnly(r.attendance_date),
      subject: r.subject ?? 'Clase',
      teacher: r.teacher ?? '',
      class_time: `${String(r.start_time).slice(0, 5)}-${String(r.end_time).slice(0, 5)}`,
      status: this.attendanceStatusLabel(r.status),
      is_justified: r.is_justified ? 'Sí' : 'No',
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
      graded_at: r.graded_at ? this.formatExportDateTime(r.graded_at) : ''
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

    const logoAbs = resolveUploadFile(branding?.institution.logoUrl ?? null);
    if (branding && logoAbs) {
      try {
        const ext = logoAbs.toLowerCase().endsWith('.jpg') || logoAbs.toLowerCase().endsWith('.jpeg') ? 'jpeg' : 'png';
        if (!logoAbs.toLowerCase().endsWith('.webp')) {
          const imageId = wb.addImage({
            base64: readFileSync(logoAbs).toString('base64'),
            extension: ext as 'png' | 'jpeg'
          });
          ws.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 120, height: 72 } });
        }
      } catch {
        // Si el logo no está disponible en disco, se exporta sin imagen.
      }
    }

    const hr = ws.getRow(headerRowIndex);
    headers.forEach((h, i) => {
      hr.getCell(i + 1).value = ExportsService.EXPORT_HEADER_LABELS[h] ?? h;
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
    if (teacher.lifecycleStatus !== TeacherLifecycleStatus.ACTIVO) {
      throw new ForbiddenException('El docente no está activo para exportar datos de grupo');
    }

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
