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

  /**
   * Credencial NFC de acceso (hex) como el QR: se crea al registrar al alumno.
   * Valor único de 32 hex; si luego se asigna tarjeta física, `assignNfcCredential` sustituye este UID.
   */
  async getOrCreateNfcForUser(userId: string): Promise<{ nfcUid: string }> {
    const existing = await this.credentialsRepository.findOne({
      where: {
        userId,
        credentialType: CredentialType.NFC,
        status: CredentialStatus.ACTIVE
      }
    });
    if (existing) {
      return { nfcUid: existing.credentialValue };
    }
    const value = randomUUID().replace(/-/g, '').toUpperCase();
    const row = this.credentialsRepository.create({
      userId,
      credentialType: CredentialType.NFC,
      credentialValue: value,
      status: CredentialStatus.ACTIVE
    });
    await this.credentialsRepository.save(row);
    return { nfcUid: row.credentialValue };
  }

  /** Usuarios de la institución para asignar/reemplazar credencial NFC (búsqueda). */
  async searchAssignableUsers(schoolId: string | null, q: string | undefined, limit = 24) {
    const take = Math.min(Math.max(limit, 1), 50);
    const qb = this.usersRepository
      .createQueryBuilder('u')
      .leftJoin('students', 's', 's.user_id = u.id AND u.role = :alumno', { alumno: UserRole.ALUMNO })
      .where('u.status = :st', { st: true })
      .andWhere('u.role IN (:...roles)', {
        roles: [UserRole.ALUMNO, UserRole.DOCENTE, UserRole.ADMINISTRATIVO, UserRole.PADRE]
      })
      .select([
        'u.id AS id',
        'u.full_name AS full_name',
        'u.email AS email',
        'u.role AS role',
        's.matricula AS matricula'
      ])
      .orderBy('u.full_name', 'ASC')
      .take(take);

    if (schoolId) {
      qb.andWhere('u.school_id = :sid', { sid: schoolId });
    }
    const term = q?.trim();
    if (term) {
      qb.andWhere(
        '(u.full_name ILIKE :t OR u.email ILIKE :t OR s.matricula ILIKE :t)',
        { t: `%${term}%` }
      );
    }

    const rows = await qb.getRawMany<{
      id: string;
      full_name: string | null;
      email: string | null;
      role: UserRole;
      matricula: string | null;
    }>();
    return rows.map((r) => ({
      userId: r.id,
      fullName: r.full_name?.trim() || '',
      email: r.email?.trim() || null,
      role: r.role,
      matricula: r.matricula?.trim() || null
    }));
  }

  async scanAccess(payload: RegisterAccessEventDto) {
    const credentialType =
      payload.method === AccessMethod.NFC || payload.method === AccessMethod.MANUAL
        ? CredentialType.NFC
        : CredentialType.QR;
    const trimmed = payload.credentialValue.trim();
    const credentialValueForLookup =
      payload.method === AccessMethod.MANUAL || payload.method === AccessMethod.NFC
        ? trimmed.replace(/[:-]/g, '').toUpperCase()
        : trimmed;
    const credential = await this.credentialsRepository.findOne({
      where: {
        credentialType,
        credentialValue: credentialValueForLookup,
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

  /** RF2 — Asignar credencial NFC a un usuario. Solo puede existir una activa por usuario. */
  async assignNfcCredential(targetUserId: string, nfcUid: string, assignedByUserId: string) {
    const user = await this.usersRepository.findOne({ where: { id: targetUserId }, select: ['id', 'fullName', 'schoolId'] });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const assignedByUser = await this.usersRepository.findOne({ where: { id: assignedByUserId }, select: ['id', 'schoolId'] });
    if (assignedByUser?.schoolId && user.schoolId && assignedByUser.schoolId !== user.schoolId) {
      throw new BadRequestException('No puede asignar credenciales a usuarios de otra institución');
    }

    const normalizedUid = nfcUid.trim().replace(/[:-]/g, '').toUpperCase();
    if (!normalizedUid) {
      throw new BadRequestException('UID NFC no válido');
    }
    // Check the NFC UID is not already taken by another active credential
    const existingForUid = await this.credentialsRepository.findOne({
      where: { credentialType: CredentialType.NFC, credentialValue: normalizedUid, status: CredentialStatus.ACTIVE }
    });
    if (existingForUid && existingForUid.userId !== targetUserId) {
      throw new BadRequestException('Este UID NFC ya está asignado a otro usuario');
    }

    // Revoke previous active NFC credential for this user
    const existingForUser = await this.credentialsRepository.findOne({
      where: { userId: targetUserId, credentialType: CredentialType.NFC, status: CredentialStatus.ACTIVE }
    });
    if (existingForUser) {
      existingForUser.status = CredentialStatus.REVOKED;
      await this.credentialsRepository.save(existingForUser);
    }

    const credential = this.credentialsRepository.create({
      userId: targetUserId,
      credentialType: CredentialType.NFC,
      credentialValue: normalizedUid,
      status: CredentialStatus.ACTIVE
    });
    await this.credentialsRepository.save(credential);
    return { message: 'Credencial NFC asignada', credentialId: credential.id, nfcUid: normalizedUid, userId: targetUserId };
  }

  /** RF2 — Listar credenciales activas de una institución (filtros opcionales). */
  async listCredentials(
    schoolId: string | null,
    page = 1,
    limit = 50,
    opts?: { search?: string | null; credentialType?: CredentialType | null; userRole?: UserRole | null }
  ) {
    const take = Math.min(Math.max(limit, 1), 200);
    const skip = (Math.max(page, 1) - 1) * take;
    const qb = this.credentialsRepository
      .createQueryBuilder('c')
      .innerJoin('users', 'u', 'u.id = c.user_id')
      .leftJoin('students', 'st', 'st.user_id = u.id')
      .where('c.status = :status', { status: CredentialStatus.ACTIVE });

    if (schoolId) qb.andWhere('u.school_id = :schoolId', { schoolId });
    if (opts?.credentialType) {
      qb.andWhere('c.credential_type = :ctype', { ctype: opts.credentialType });
    }
    if (opts?.userRole) {
      qb.andWhere('u.role = :urole', { urole: opts.userRole });
    }
    const term = opts?.search?.trim();
    if (term) {
      qb.andWhere(
        '(u.full_name ILIKE :q OR u.email ILIKE :q OR c.credential_value ILIKE :q OR st.matricula ILIKE :q)',
        { q: `%${term}%` }
      );
    }

    const countQb = qb.clone();
    const [rows, total] = await Promise.all([
      qb
        .select([
          'c.id AS id',
          'c.user_id AS "userId"',
          'c.credential_type AS "credentialType"',
          'c.credential_value AS "credentialValue"',
          'c.status AS status',
          'c.created_at AS "createdAt"',
          'u.full_name AS "userFullName"',
          'u.email AS "userEmail"',
          'u.role AS "userRole"',
          'st.matricula AS "matricula"'
        ])
        .orderBy('c.created_at', 'DESC')
        .offset(skip)
        .limit(take)
        .getRawMany<Record<string, unknown>>(),
      countQb.getCount()
    ]);
    return { data: rows, meta: { total, page: Math.max(page, 1), limit: take, pages: Math.ceil(total / take) || 1 } };
  }

  /** RF2 — Revocar una credencial por ID. */
  async revokeCredential(credentialId: string, requestedByUserId: string) {
    const credential = await this.credentialsRepository.findOne({ where: { id: credentialId } });
    if (!credential) throw new NotFoundException('Credencial no encontrada');
    if (credential.status === CredentialStatus.REVOKED) {
      return { message: 'La credencial ya estaba revocada' };
    }
    const user = await this.usersRepository.findOne({ where: { id: requestedByUserId }, select: ['id', 'schoolId'] });
    const credUser = await this.usersRepository.findOne({ where: { id: credential.userId }, select: ['id', 'schoolId'] });
    if (user?.schoolId && credUser?.schoolId && user.schoolId !== credUser.schoolId) {
      throw new BadRequestException('No puede revocar credenciales de otra institución');
    }
    credential.status = CredentialStatus.REVOKED;
    await this.credentialsRepository.save(credential);
    return { message: 'Credencial revocada', credentialId };
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
    const methodLabel =
      payload.method === AccessMethod.NFC
        ? 'NFC'
        : payload.method === AccessMethod.MANUAL
          ? 'UID manual'
          : 'QR';
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
