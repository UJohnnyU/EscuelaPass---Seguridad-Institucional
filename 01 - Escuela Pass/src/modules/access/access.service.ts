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
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
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
import { minutesSinceMidnightInTimeZone, parseTimeToMinutes } from '../../common/shift-schedule';

@Injectable()
export class AccessService {
  private readonly logger = new Logger(AccessService.name);

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
    private readonly fcmService: FcmService,
    private readonly auditService: AuditService
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

  async scanAccess(
    payload: RegisterAccessEventDto,
    operator: { userId: string; role: UserRole; schoolId?: string | null }
  ) {
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
    // Aislamiento multi-tenant: salvo ADMIN de plataforma, el operador no puede
    // procesar credenciales de personas de otra escuela.
    if (operator.role !== UserRole.ADMIN) {
      const operatorSchoolId = operator.schoolId ?? null;
      if (!operatorSchoolId || operatorSchoolId !== user.schoolId) {
        throw new ForbiddenException('Credencial fuera de su escuela.');
      }
    }
    if (!user.canAccessCampus) {
      throw new BadRequestException('Usuario sin permiso de acceso al campus');
    }
    const duplicate = await this.findRecentAccessEventForUserInSchool(user.id, user.schoolId);
    if (duplicate) {
      return {
        duplicate: true,
        originalEvent: duplicate
      };
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
      registeredBy: operator.userId
    });
    const saved = await this.eventsRepository.save(event);

    if (user.role === UserRole.ALUMNO && payload.eventType === AccessEventType.ENTRY) {
      await this.upsertAttendanceFromAccessScan(user.id, today, payload.method, saved.eventTime);
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

    // Minimizamos PII en la respuesta del scan: nombre y status si, pero email
    // se omite y la matricula se enmascara mostrando solo los ultimos 4.
    const matriculaMasked = matricula ? this.maskMatricula(matricula) : null;

    return {
      message: 'Acceso registrado correctamente',
      persona: {
        nombreCompleto: user.fullName,
        rol: user.role,
        matriculaAlumno: matriculaMasked,
        avatarUrl: user.avatarPath ?? null,
        grupo: groupName,
        acceso: user.canAccessCampus ? 'AUTORIZADO' : 'SIN_AUTORIZAR',
        eventoTipo: payload.eventType,
        eventoTiempo: saved.eventTime.toISOString()
      }
    };
  }

  private maskMatricula(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length <= 4) return '*'.repeat(Math.max(trimmed.length, 1));
    return `****${trimmed.slice(-4)}`;
  }

  private async findRecentAccessEventForUserInSchool(
    userId: string,
    schoolId: string | null
  ): Promise<AccessEventEntity | null> {
    const since = new Date(Date.now() - 10_000);
    const qb = this.eventsRepository
      .createQueryBuilder('ev')
      .innerJoin('users', 'u', 'u.id = ev.user_id')
      .where('ev.user_id = :userId', { userId })
      .andWhere('ev.event_time >= :since', { since })
      .orderBy('ev.event_time', 'DESC');
    if (schoolId) {
      qb.andWhere('u.school_id = :schoolId', { schoolId });
    } else {
      qb.andWhere('u.school_id IS NULL');
    }
    return qb.getOne();
  }

  private async upsertAttendanceFromAccessScan(
    userId: string,
    dateStr: string,
    method: 'QR' | 'NFC' | 'MANUAL',
    scanAt: Date
  ) {
    const student = await this.studentsRepository.findOne({ where: { userId } });
    if (!student) return;

    const cal = await this.schoolCalendarService.getNonInstructionalForDate(
      dateStr,
      student.groupId ?? null
    );
    if (cal.nonInstructional) return;

    const autoNote = `AUTO_ACCESS_SCAN:${method}:ENTRY`;
    const dailyStatus = await this.resolveDailyStatusFromEntryScan(student, scanAt);
    if (!dailyStatus) return;

    const existing = await this.attendanceRepository.findOne({
      where: { studentId: student.id, attendanceDate: dateStr }
    });

    if (existing) {
      if (this.isManualDailyAttendance(existing)) return;
      if (existing.status === AttendanceStatus.AUSENTE) {
        existing.status = dailyStatus;
      }
      existing.groupId = student.groupId ?? null;
      existing.classSessionId = null;
      existing.notes = this.appendAutoAccessNote(existing.notes, autoNote);
      await this.attendanceRepository.save(existing);
      return;
    }

    const created = this.attendanceRepository.create({
      studentId: student.id,
      groupId: student.groupId ?? null,
      classSessionId: null,
      attendanceDate: dateStr,
      status: dailyStatus,
      notes: autoNote,
      registeredBy: null
    });
    await this.attendanceRepository.save(created);
  }

  private isManualDailyAttendance(record: AttendanceRecordEntity): boolean {
    return Boolean(record.registeredBy) && !this.hasAutoAccessNote(record.notes);
  }

  private hasAutoAccessNote(notes: string | null | undefined): boolean {
    return Boolean(notes?.includes('AUTO_ACCESS_SCAN:'));
  }

  private appendAutoAccessNote(notes: string | null | undefined, note: string): string {
    if (!notes) return note;
    if (notes.includes(note)) return notes;
    return `${notes} | ${note}`;
  }

  private async resolveDailyStatusFromEntryScan(
    student: StudentEntity,
    scanAt: Date
  ): Promise<AttendanceStatus | null> {
    const rows = await this.studentsRepository.manager.query<
      {
        shift: string | null;
        shiftMatutinoStart: string | null;
        shiftMatutinoEnd: string | null;
        shiftVespertinoStart: string | null;
        shiftVespertinoEnd: string | null;
        shiftNocturnoStart: string | null;
        shiftNocturnoEnd: string | null;
      }[]
    >(
      `SELECT g.shift::text AS shift,
              sc.shift_matutino_start AS "shiftMatutinoStart",
              sc.shift_matutino_end AS "shiftMatutinoEnd",
              sc.shift_vespertino_start AS "shiftVespertinoStart",
              sc.shift_vespertino_end AS "shiftVespertinoEnd",
              sc.shift_nocturno_start AS "shiftNocturnoStart",
              sc.shift_nocturno_end AS "shiftNocturnoEnd"
       FROM students s
       LEFT JOIN groups g ON g.id = s.group_id
       LEFT JOIN schools sc ON sc.id = COALESCE(g.school_id, s.school_id)
       WHERE s.id = $1
       LIMIT 1`,
      [student.id]
    );
    const row = rows[0];
    if (!row) return AttendanceStatus.PRESENTE;

    const startRaw =
      row.shift === 'VESPERTINO'
        ? row.shiftVespertinoStart
        : row.shift === 'NOCTURNO'
          ? row.shiftNocturnoStart
          : row.shiftMatutinoStart;
    const endRaw =
      row.shift === 'VESPERTINO'
        ? row.shiftVespertinoEnd
        : row.shift === 'NOCTURNO'
          ? row.shiftNocturnoEnd
          : row.shiftMatutinoEnd;
    const start = parseTimeToMinutes(startRaw);
    const end = parseTimeToMinutes(endRaw);
    if (start === null || end === null) return AttendanceStatus.PRESENTE;

    const scanMinutes = minutesSinceMidnightInTimeZone(undefined, scanAt);
    if (scanMinutes > end) return null;
    const graceMinutes = Number.parseInt(process.env.ATTENDANCE_ENTRY_GRACE_MINUTES ?? '10', 10);
    const grace = Number.isFinite(graceMinutes) ? graceMinutes : 10;
    return scanMinutes <= start + grace ? AttendanceStatus.PRESENTE : AttendanceStatus.RETARDO;
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

    try {
      return await this.credentialsRepository.manager.transaction(async (em) => {
        const credRepo = em.getRepository(AccessCredentialEntity);

        const existingForUid = await credRepo.findOne({
          where: { credentialType: CredentialType.NFC, credentialValue: normalizedUid }
        });
        if (
          existingForUid?.status === CredentialStatus.ACTIVE &&
          existingForUid.userId !== targetUserId
        ) {
          throw new BadRequestException('Este UID NFC ya está asignado a otro usuario');
        }

        const existingForUser = await credRepo.findOne({
          where: { userId: targetUserId, credentialType: CredentialType.NFC, status: CredentialStatus.ACTIVE }
        });
        if (existingForUser && existingForUser.id !== existingForUid?.id) {
          existingForUser.status = CredentialStatus.REVOKED;
          await credRepo.save(existingForUser);
        }

        let credential: AccessCredentialEntity;
        if (existingForUid) {
          existingForUid.userId = targetUserId;
          existingForUid.status = CredentialStatus.ACTIVE;
          credential = await credRepo.save(existingForUid);
        } else {
          credential = credRepo.create({
            userId: targetUserId,
            credentialType: CredentialType.NFC,
            credentialValue: normalizedUid,
            status: CredentialStatus.ACTIVE
          });
          credential = await credRepo.save(credential);
        }

        return {
          message: 'Credencial NFC asignada',
          credentialId: credential.id,
          nfcUid: normalizedUid,
          userId: targetUserId
        };
      });
    } catch (err) {
      if (err instanceof QueryFailedError) {
        const code = (err.driverError as { code?: string } | undefined)?.code;
        if (code === '23505') {
          throw new BadRequestException('Este UID NFC ya está registrado');
        }
      }
      throw err;
    }
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
    await this.auditService
      .log(requestedByUserId, 'access.credential.revoke', 'access_credentials', credentialId, {
        credentialType: credential.credentialType,
        ownerUserId: credential.userId,
        schoolId: credUser?.schoolId ?? null
      })
      .catch((err) =>
        this.logger.error('No se pudo registrar auditoría de revocación de credencial', err as Error)
      );
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
