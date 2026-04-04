import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AccessCredentialEntity,
  CredentialStatus,
  CredentialType
} from '../../database/entities/access-credential.entity';
import { AccessEventEntity } from '../../database/entities/access-event.entity';
import {
  AttendanceRecordEntity,
  AttendanceStatus
} from '../../database/entities/attendance-record.entity';
import { AccessEventType } from '../../database/entities/access-event.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { RegisterAccessEventDto } from './dto/register-access-event.dto';
import { SchoolCalendarService } from '../school-calendar/school-calendar.service';

@Injectable()
export class AccessService {
  constructor(
    @InjectRepository(AccessCredentialEntity)
    private readonly credentialsRepository: Repository<AccessCredentialEntity>,
    @InjectRepository(AccessEventEntity)
    private readonly eventsRepository: Repository<AccessEventEntity>,
    @InjectRepository(AttendanceRecordEntity)
    private readonly attendanceRepository: Repository<AttendanceRecordEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentsRepository: Repository<StudentEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    private readonly schoolCalendarService: SchoolCalendarService
  ) {}

  /** Credencial QR para mostrar en perfil (acceso campus / asistencia). Crea una si no existe. */
  async getOrCreateQrForUser(userId: string) {
    const existing = await this.credentialsRepository.findOne({
      where: {
        userId,
        credentialType: CredentialType.QR,
        status: CredentialStatus.ACTIVE
      }
    });
    if (existing) {
      return { qrValue: existing.credentialValue };
    }
    const value = `QR_${randomUUID()}`;
    const row = this.credentialsRepository.create({
      userId,
      credentialType: CredentialType.QR,
      credentialValue: value,
      status: CredentialStatus.ACTIVE
    });
    await this.credentialsRepository.save(row);
    return { qrValue: row.credentialValue };
  }

  async scanAccess(payload: RegisterAccessEventDto) {
    const credentialType =
      payload.method === 'NFC' ? CredentialType.NFC : CredentialType.QR;
    const credential = await this.credentialsRepository.findOne({
      where: {
        credentialType,
        credentialValue: payload.credentialValue,
        status: CredentialStatus.ACTIVE
      }
    });
    if (!credential) {
      throw new NotFoundException('Credencial no encontrada o inactiva');
    }
    const user = await this.usersRepository.findOne({ where: { id: credential.userId } });
    if (!user) {
      throw new NotFoundException('Usuario de credencial no existe');
    }
    if (!user.canAccessCampus) {
      throw new BadRequestException('Usuario sin permiso de acceso al campus');
    }
    const today = new Date().toISOString().slice(0, 10);
    if (user.role === UserRole.ALUMNO) {
      const already = await this.eventsRepository.findOne({
        where: {
          userId: user.id,
          eventDate: today,
          eventType: payload.eventType
        }
      });
      if (already) {
        throw new BadRequestException('Alumno ya registró este tipo de acceso hoy');
      }
    }
    const event = this.eventsRepository.create({
      userId: user.id,
      roleSnapshot: user.role,
      eventType: payload.eventType,
      method: payload.method,
      eventTime: new Date(),
      eventDate: today,
      accessCredentialId: credential.id,
      registeredBy: payload.registeredBy ?? null
    });
    const saved = await this.eventsRepository.save(event);

    if (user.role === UserRole.ALUMNO && payload.eventType === AccessEventType.ENTRY) {
      await this.upsertAttendanceFromAccessScan(user.id, today, payload.method);
    }

    let matricula: string | null = null;
    if (user.role === UserRole.ALUMNO) {
      const st = await this.studentsRepository.findOne({ where: { userId: user.id } });
      matricula = st?.matricula ?? null;
    }

    return {
      message: 'Acceso registrado correctamente',
      persona: {
        nombreCompleto: user.fullName,
        rol: user.role,
        matriculaAlumno: matricula
      }
    };
  }

  private async upsertAttendanceFromAccessScan(
    userId: string,
    dateStr: string,
    method: 'QR' | 'NFC' | 'MANUAL'
  ) {
    const student = await this.studentsRepository.findOne({ where: { userId } });
    if (!student) return;

    const cal = await this.schoolCalendarService.getNonInstructionalForDate(
      dateStr,
      student.groupId ?? null
    );
    if (cal.nonInstructional) return;

    const autoNote = `AUTO_ACCESS_SCAN:${method}:ENTRY`;
    const existing = await this.attendanceRepository.findOne({
      where: { studentId: student.id, attendanceDate: dateStr }
    });

    if (existing) {
      existing.status = AttendanceStatus.PRESENTE;
      existing.groupId = student.groupId ?? null;
      existing.notes = existing.notes ? `${existing.notes} | ${autoNote}` : autoNote;
      await this.attendanceRepository.save(existing);
      return;
    }

    const created = this.attendanceRepository.create({
      studentId: student.id,
      groupId: student.groupId ?? null,
      attendanceDate: dateStr,
      status: AttendanceStatus.PRESENTE,
      notes: autoNote,
      registeredBy: null
    });
    await this.attendanceRepository.save(created);
  }
}
