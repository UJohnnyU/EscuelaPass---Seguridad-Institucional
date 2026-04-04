import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import PDFDocument from 'pdfkit';
import { Repository } from 'typeorm';
import { GradeEntity } from '../../database/entities/grade.entity';
import { GroupEntity } from '../../database/entities/group.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { GradesService } from '../grades/grades.service';
import { SchedulesService } from '../schedules/schedules.service';
import { SettingsService } from '../settings/settings.service';

const WEEKDAY_LABEL = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

@Injectable()
export class DocumentsService {
  constructor(
    private readonly gradesService: GradesService,
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
    studentId: string,
    userId: string,
    role: UserRole,
    period?: string
  ): Promise<Buffer> {
    const grades = await this.gradesService.listByStudent(studentId, userId, role, period, undefined);
    const student = await this.studentsRepository.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Estudiante no encontrado');
    const user = await this.usersRepository.findOne({ where: { id: student.userId } });
    const name = user?.fullName ?? student.matricula;
    const institution = await this.settingsService.getInstitutionProfile();
    const group = student.groupId
      ? await this.groupsRepository.findOne({ where: { id: student.groupId } })
      : null;

    const bySubject = new Map<string, GradeEntity[]>();
    for (const g of grades) {
      const list = bySubject.get(g.subject) ?? [];
      list.push(g);
      bySubject.set(g.subject, list);
    }

    const issued = new Date().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

    return this.pdfBuffer((doc) => {
      const left = doc.page.margins.left;
      const contentW = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      doc.fontSize(18).font('Helvetica-Bold').text(institution.name, { align: 'center', width: contentW });
      doc.font('Helvetica');
      if (institution.motto) {
        doc.fontSize(9).fillColor('#444444').text(institution.motto, { align: 'center', width: contentW });
        doc.fillColor('#000000');
      }
      const addrLine = [institution.address, institution.city].filter(Boolean).join(' · ');
      if (addrLine) doc.fontSize(9).text(addrLine, { align: 'center', width: contentW });
      const contact = [institution.phone, institution.email].filter(Boolean).join(' · ');
      if (contact) doc.fontSize(9).text(contact, { align: 'center', width: contentW });

      doc.moveDown(1.2);
      doc.fontSize(14).font('Helvetica-Bold').text('BOLETÍN DE CALIFICACIONES', { align: 'center' });
      doc.font('Helvetica');
      doc.moveDown(0.8);

      doc.fontSize(11);
      doc.text(`Nombre: ${name}`);
      doc.text(`Matrícula: ${student.matricula}`);
      if (group) {
        doc.text(
          `Grupo: ${group.name} · Año escolar: ${group.schoolYear} · Turno: ${group.shift}` +
            (group.grade ? ` · Grado: ${group.grade}` : '')
        );
      }
      if (period) doc.text(`Período académico (filtro): ${period}`);
      doc.moveDown(0.6);

      if (!grades.length) {
        doc.fontSize(10).text('No hay calificaciones registradas para los criterios indicados.');
        return;
      }

      for (const [subject, items] of bySubject) {
        doc.fontSize(12).font('Helvetica-Bold').text(subject, left);
        doc.font('Helvetica');
        doc.fontSize(10);
        doc.font('Helvetica-Oblique').text(
          'Período · Evaluación · Calificación · Observaciones',
          left,
          doc.y,
          { width: contentW }
        );
        doc.font('Helvetica');
        doc.moveDown(0.35);
        for (const g of items) {
          const line = `${g.period} · ${g.assessmentName}: ${g.score} / ${g.maxScore}${
            g.notes ? ` — ${g.notes}` : ''
          }`;
          doc.text(line, { width: contentW });
          doc.moveDown(0.2);
        }
        doc.moveDown(0.5);
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
    });
  }

  async buildGroupSchedulePdf(groupId: string, userId: string, role: UserRole): Promise<Buffer> {
    const slots = await this.schedulesService.listByGroup(groupId, userId, role);
    const group = await this.groupsRepository.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Grupo no encontrado');
    const institution = await this.settingsService.getInstitutionProfile();

    return this.pdfBuffer((doc) => {
      const contentW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      doc.fontSize(14).font('Helvetica-Bold').text(institution.name, { align: 'center', width: contentW });
      doc.font('Helvetica');
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
    void userId;

    const institution = await this.settingsService.getInstitutionProfile();
    const groups = await this.groupsRepository.find({ order: { schoolYear: 'DESC', name: 'ASC' } });
    const lines: string[] = [];
    for (const g of groups) {
      const n = await this.studentsRepository.count({ where: { groupId: g.id } });
      lines.push(`${g.name} · ${g.schoolYear} · ${g.shift} · alumnos: ${n}`);
    }

    return this.pdfBuffer((doc) => {
      const contentW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      doc.fontSize(14).font('Helvetica-Bold').text(institution.name, { align: 'center', width: contentW });
      doc.font('Helvetica').moveDown(0.5);
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

  private pdfBuffer(render: (doc: InstanceType<typeof PDFDocument>) => void): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      try {
        render(doc);
        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }
}
