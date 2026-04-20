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
import { AccessEventType, AccessMethod } from '../../database/entities/access-event.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { RegisterAccessEventDto } from './dto/register-access-event.dto';
import { SchoolCalendarService } from '../school-calendar/school-calendar.service';
import { NotificationEntity } from '../../database/entities/notification.entity';
import { FcmService } from '../fcm/fcm.service';

@Injectable()
export class AccessService {
  constructor(
    @InjectRepository(AccessCredentialEntity)
    private readonly credentialsRepository: Repository<AccessCredentialEntity>,
    @InjectRepository(AccessEventEntity)
    private readonly eventsRepository: Repository<AccessEventEntity>,
    @InjectRepository(AttendanceRecordEntity)
    private readonly attendanceRepository: Repository<AttendanceRecordEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notificationsRepository: Repository<NotificationEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentsRepository: Repository<StudentEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    private readonly schoolCalendarService: SchoolCalendarService,
    private readonly fcmService: FcmService
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

    if (user.role === UserRole.ALUMNO) {
      void this.notifyParentsStudentAccess(user.id, user.fullName ?? 'Su hijo/a', payload).catch(
        () => undefined
      );
    }

    let matricula: string | null = null;
    let groupName: string | null = null;
    if (user.role === UserRole.ALUMNO) {
      const st = await this.studentsRepository.findOne({ where: { userId: user.id } });
      matricula = st?.matricula ?? null;
      if (st?.groupId) {
        const g = await this.studentsRepository.manager.query<{ name: string }[]>(
          `SELECT name FROM groups WHERE id = $1 LIMIT 1`,
          [st.groupId]
        );
        groupName = g[0]?.name ?? null;
      }
    }

    return {
      message: 'Acceso registrado correctamente',
      persona: {
        nombreCompleto: user.fullName,
        rol: user.role,
        matriculaAlumno: matricula,
        email: user.email ?? null,
        avatarUrl: user.avatarPath ?? null,
        grupo: groupName,
        acceso: user.canAccessCampus ? 'AUTORIZADO' : 'SIN_AUTORIZAR',
        eventoTipo: payload.eventType,
        eventoTiempo: saved.eventTime.toISOString()
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

  private async notifyParentsStudentAccess(
    studentUserId: string,
    studentName: string,
    payload: { eventType: AccessEventType; method: AccessMethod }
  ): Promise<void> {
    const parentRows = await this.usersRepository.manager.query<{ id: string }[]>(
      `SELECT DISTINCT u.id
       FROM student_parents sp
       INNER JOIN students s ON s.id = sp.student_id
       INNER JOIN parents p ON p.id = sp.parent_id
       INNER JOIN users u ON u.id = p.user_id
       WHERE s.user_id = $1`,
      [studentUserId]
    );
    if (!parentRows.length) return;

    const verb =
      payload.eventType === AccessEventType.ENTRY ? 'entró a' : 'salió de';
    const title =
      payload.eventType === AccessEventType.ENTRY ? 'Entrada registrada' : 'Salida registrada';
    const methodLabel = payload.method === AccessMethod.NFC ? 'NFC' : 'QR';
    const message = `${studentName} ${verb} la institución (${methodLabel}).`;

    for (const row of parentRows) {
      const rowEntity = this.notificationsRepository.create({
        userId: row.id,
        noticeId: null,
        title,
        message,
        deliveryStatus: 'SENT'
      });
      const saved = await this.notificationsRepository.save(rowEntity);
      void this.fcmService
        .sendPushToUser(row.id, title, message, {
          type: 'student_access',
          notificationId: saved.id,
          eventType: payload.eventType,
          deepLink: '/app/modulos/comunicacion'
        })
        .catch(() => undefined);
    }
  }
}
