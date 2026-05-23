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

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import PDFDocument from 'pdfkit';
import { Repository } from 'typeorm';
import { GroupEntity } from '../../database/entities/group.entity';
import { ReportCardStatus, ReportCardType } from '../../database/entities/report-card.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { resolveUploadFile } from '../../lib/uploads-path';
import { ReportCardsService } from '../report-cards/report-cards.service';
import { SchedulesService } from '../schedules/schedules.service';
import { SettingsService } from '../settings/settings.service';

export type BulkBulletinFilters = {
  schoolId?: string | null;
  schoolYear?: string | null;
  periodId?: string | null;
  type?: ReportCardType | null;
  studentId?: string | null;
  groupId?: string | null;
};

const WEEKDAY_LABEL = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

@Injectable()
export class DocumentsService {
  constructor(
    private readonly reportCardsService: ReportCardsService,
    private readonly schedulesService: SchedulesService,
    private readonly settingsService: SettingsService,
    @InjectRepository(GroupEntity)
    private readonly groupsRepository: Repository<GroupEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentsRepository: Repository<StudentEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>
  ) {}

  async buildBulletinPdf(
    reportCardId: string,
    userId: string,
    role: UserRole
  ): Promise<Buffer> {
    const card = await this.reportCardsService.getDetail(reportCardId, userId, role);
    if (role !== UserRole.ADMIN && role !== UserRole.ADMINISTRATIVO && role !== UserRole.DOCENTE) {
      if (card.status !== ReportCardStatus.PUBLISHED) {
        throw new ForbiddenException('El boletín aún no está publicado');
      }
    }
    return this.pdfBuffer(async (doc) => {
      await this.renderBulletinPage(doc, card);
    });
  }

  /**
   * Devuelve un único PDF combinado con un boletín por página, según los filtros indicados.
   * Pensado para que docentes y administradores descarguen masivamente los boletines.
   */
  async buildBulletinsBulkPdf(
    userId: string,
    role: UserRole,
    filters: BulkBulletinFilters
  ): Promise<{ buffer: Buffer; filename: string; count: number }> {
    if (
      role !== UserRole.ADMIN &&
      role !== UserRole.ADMINISTRATIVO &&
      role !== UserRole.DOCENTE
    ) {
      throw new ForbiddenException('Solo el personal del plantel puede descargar boletines en lote');
    }

    const summaries = await this.reportCardsService.listForAdmin(userId, role, {
      schoolId: filters.schoolId ?? undefined,
      schoolYear: filters.schoolYear ?? undefined,
      periodId: filters.periodId ?? undefined,
      type: filters.type ?? undefined,
      studentId: filters.studentId ?? undefined
    });

    let cards = summaries.filter((c) => c.status === ReportCardStatus.PUBLISHED);

    if (filters.groupId) {
      const studentsOfGroup = await this.studentsRepository.find({
        where: { groupId: filters.groupId },
        select: { id: true }
      });
      const allowed = new Set(studentsOfGroup.map((s) => s.id));
      cards = cards.filter((c) => allowed.has(c.studentId));
    }

    if (cards.length === 0) {
      throw new BadRequestException('No hay boletines publicados que coincidan con los filtros');
    }

    const details: Awaited<ReturnType<ReportCardsService['getDetail']>>[] = [];
    for (const summary of cards) {
      const detail = await this.reportCardsService.getDetail(summary.id, userId, role);
      details.push(detail);
    }

    const buffer = await this.pdfBuffer(async (doc) => {
      for (let i = 0; i < details.length; i += 1) {
        if (i > 0) doc.addPage();
        await this.renderBulletinPage(doc, details[i]);
      }
    });

    const parts: string[] = ['boletines'];
    if (filters.type) parts.push(filters.type === ReportCardType.FINAL ? 'finales' : 'periodo');
    if (filters.schoolYear) parts.push(filters.schoolYear);
    parts.push(`${details.length}`);
    const filename = `${parts.join('-')}.pdf`;

    return { buffer, filename, count: details.length };
  }

  private async renderBulletinPage(
    doc: InstanceType<typeof PDFDocument>,
    card: Awaited<ReturnType<ReportCardsService['getDetail']>>
  ): Promise<void> {
    const student = await this.studentsRepository.findOne({ where: { id: card.studentId } });
    if (!student) throw new NotFoundException('Estudiante no encontrado');
    const group = student.groupId
      ? await this.groupsRepository.findOne({ where: { id: student.groupId } })
      : null;
    const institution = await this.settingsService.getInstitutionProfileForSchoolId(
      group?.schoolId ?? null
    );

    const issued = new Date().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
    const title =
      card.type === ReportCardType.FINAL ? 'BOLETÍN FINAL' : 'BOLETÍN DE PERIODO';

    const left = doc.page.margins.left;
    const contentW = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    const logoAbs = resolveUploadFile(institution.logoUrl ?? null);
    const headerTop = doc.y;
    const logoSize = 60;
    const rightLogoX = left + contentW - logoSize;
    let logoDrawn = false;
    if (logoAbs) {
      try {
        doc.image(logoAbs, left, headerTop, { fit: [logoSize, logoSize] });
        doc.image(logoAbs, rightLogoX, headerTop, { fit: [logoSize, logoSize] });
        logoDrawn = true;
      } catch {
        /* Ignoramos imágenes corruptas o formatos no soportados. */
      }
    }

    const textLeft = logoDrawn ? left + logoSize + 12 : left;
    const textWidth = logoDrawn ? contentW - (logoSize + 12) * 2 : contentW;
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(institution.name, textLeft, headerTop, { width: textWidth, align: 'center' });
    doc.font('Helvetica');
    if (institution.motto) {
      doc.fontSize(9).fillColor('#444444').text(institution.motto, textLeft, doc.y, {
        width: textWidth,
        align: 'center'
      });
      doc.fillColor('#000000');
    }
    const addrLine = [institution.address, institution.city].filter(Boolean).join(' · ');
    if (addrLine)
      doc.fontSize(9).text(addrLine, textLeft, doc.y, { width: textWidth, align: 'center' });
    const contact = [institution.phone, institution.email].filter(Boolean).join(' · ');
    if (contact)
      doc.fontSize(9).text(contact, textLeft, doc.y, { width: textWidth, align: 'center' });
    // Asegura que el siguiente bloque no quede solapado con el logo
    const afterHeader = Math.max(doc.y, headerTop + (logoDrawn ? logoSize + 6 : 0));
    doc.y = afterHeader;
    doc.x = left;

    doc.moveDown(1.2);
    doc.fontSize(14).font('Helvetica-Bold').text(title, { align: 'center' });
    doc.font('Helvetica');
    doc.moveDown(0.8);

    doc.fontSize(11);
    doc.text(`Nombre: ${card.studentName}`);
    doc.text(`Matrícula: ${card.matricula}`);
    if (group) {
      doc.text(
        `Grupo: ${group.name} · Año escolar: ${group.schoolYear} · Turno: ${group.shift}` +
          (group.grade ? ` · Grado: ${group.grade}` : '')
      );
    }
    if (card.periodName) doc.text(`Periodo: ${card.periodName}`);
    doc.text(`Escala de calificación: 0 a ${card.maxGradeScale}`);
    doc.text(`Nota mínima aprobatoria: ${card.passingGrade}`);
    doc.moveDown(0.6);

    if (card.subjects.length === 0) {
      doc.fontSize(10).text('No hay calificaciones registradas para el periodo.');
    } else {
      doc.fontSize(12).font('Helvetica-Bold').text('Materias y promedios', left);
      doc.font('Helvetica');
      doc.fontSize(10);
      doc.moveDown(0.3);
      for (const s of card.subjects) {
        const estado = s.isPassing ? 'APROBADA' : 'REPROBADA';
        doc.text(
          `${s.subjectName}: ${s.average} / ${card.maxGradeScale} · ${estado} ` +
            `(actividades: ${s.activityCount}, calificadas: ${s.gradedCount})`,
          { width: contentW }
        );
        doc.moveDown(0.15);
      }
    }

    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica-Bold').text(
      `Promedio general: ${card.overallAverage} / ${card.maxGradeScale}`
    );
    doc.font('Helvetica');
    if (card.type === ReportCardType.FINAL) {
      doc.fontSize(12).font('Helvetica-Bold').text(
        `Promoción: ${card.promotionStatus ?? 'SIN ESTADO'} ` +
          `(materias reprobadas: ${card.failedSubjectsCount}; mínimo para reprobar: ${card.minFailedSubjectsToRepeat})`
      );
      doc.font('Helvetica');
    }

    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#555555');
    doc.text(`Documento generado el ${issued}.`, { align: 'left' });
    if (institution.directorName) {
      doc.moveDown(2);
      doc.text('______________________________', left);
      doc.text(institution.directorName, left);
      doc.text('Director(a) / Responsable académico', left);
    }
    doc.fillColor('#000000');
  }

  async buildGroupSchedulePdf(groupId: string, userId: string, role: UserRole): Promise<Buffer> {
    const slots = await this.schedulesService.listByGroup(groupId, userId, role);
    const group = await this.groupsRepository.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Grupo no encontrado');
    const institution = await this.settingsService.getInstitutionProfileForSchoolId(group.schoolId);

    return this.pdfBuffer((doc) => {
      this.drawInstitutionHeader(doc, institution);
      doc.moveDown(0.5);
      doc.fontSize(16).text('Horario del grupo', { align: 'center' });
      doc.moveDown();
      doc
        .fontSize(11)
        .text(`${group.name} · ${group.schoolYear} · ${group.shift} · Grado: ${group.grade ?? '—'}`);
      doc.moveDown();
      if (!slots.length) {
        doc.fontSize(10).text('No hay franjas horarias cargadas para este grupo.');
        return;
      }
      doc.fontSize(10);
      for (const s of slots) {
        const day = WEEKDAY_LABEL[s.weekday] ?? String(s.weekday);
        doc.text(
          `${day} ${String(s.startTime).slice(0, 5)}–${String(s.endTime).slice(0, 5)}` +
            (s.room ? ` · Aula ${s.room}` : '')
        );
        doc.moveDown(0.25);
      }
    });
  }

  async buildGroupsSummaryPdf(userId: string, role: UserRole): Promise<Buffer> {
    if (role !== UserRole.ADMIN && role !== UserRole.ADMINISTRATIVO) {
      throw new ForbiddenException('Solo administración puede exportar el resumen de grupos');
    }

    const institution = await this.settingsService.getInstitutionProfileForSchoolId(null);
    let groups: GroupEntity[] = [];
    if (role === UserRole.ADMINISTRATIVO) {
      const me = await this.usersRepository.findOne({ where: { id: userId } });
      if (!me?.schoolId) throw new ForbiddenException('Usuario sin escuela asignada');
      groups = await this.groupsRepository.find({
        where: { schoolId: me.schoolId },
        order: { schoolYear: 'DESC', name: 'ASC' }
      });
    } else {
      groups = await this.groupsRepository.find({ order: { schoolYear: 'DESC', name: 'ASC' } });
    }
    const lines: string[] = [];
    for (const g of groups) {
      const n = await this.studentsRepository.count({ where: { groupId: g.id } });
      lines.push(`${g.name} · ${g.schoolYear} · ${g.shift} · alumnos: ${n}`);
    }

    return this.pdfBuffer((doc) => {
      this.drawInstitutionHeader(doc, institution);
      doc.moveDown(0.5);
      doc.fontSize(16).text('Resumen de grupos', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10);
      if (!lines.length) {
        doc.text('No hay grupos registrados.');
        return;
      }
      for (const line of lines) {
        doc.text(line);
        doc.moveDown(0.25);
      }
    });
  }

  private drawInstitutionHeader(
    doc: InstanceType<typeof PDFDocument>,
    institution: { name: string; motto?: string | null; logoUrl?: string | null }
  ): void {
    const left = doc.page.margins.left;
    const contentW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const logoAbs = resolveUploadFile(institution.logoUrl ?? null);
    const headerTop = doc.y;
    const logoSize = 50;
    const rightLogoX = left + contentW - logoSize;
    let logoDrawn = false;
    if (logoAbs) {
      try {
        doc.image(logoAbs, left, headerTop, { fit: [logoSize, logoSize] });
        doc.image(logoAbs, rightLogoX, headerTop, { fit: [logoSize, logoSize] });
        logoDrawn = true;
      } catch {
        /* ignore */
      }
    }
    const textLeft = logoDrawn ? left + logoSize + 10 : left;
    const textWidth = logoDrawn ? contentW - (logoSize + 10) * 2 : contentW;
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(institution.name, textLeft, headerTop, { width: textWidth, align: 'center' });
    doc.font('Helvetica');
    if (institution.motto) {
      doc
        .fontSize(9)
        .fillColor('#444444')
        .text(institution.motto, textLeft, doc.y, { width: textWidth, align: 'center' })
        .fillColor('#000000');
    }
    const afterHeader = Math.max(doc.y, headerTop + (logoDrawn ? logoSize + 4 : 0));
    doc.y = afterHeader;
    doc.x = left;
  }

  private pdfBuffer(
    render: (doc: InstanceType<typeof PDFDocument>) => void | Promise<void>
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      Promise.resolve()
        .then(() => render(doc))
        .then(() => doc.end())
        .catch(reject);
    });
  }
}
