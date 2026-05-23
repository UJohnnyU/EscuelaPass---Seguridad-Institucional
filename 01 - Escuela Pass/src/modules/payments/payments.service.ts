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
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdministrativeStaffEntity } from '../../database/entities/administrative-staff.entity';
import { DebtAdjustmentActionType, DebtAdjustmentEntity } from '../../database/entities/debt-adjustment.entity';
import { DebtEntity, PaymentStatus } from '../../database/entities/debt.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { PaymentConceptEntity } from '../../database/entities/payment-concept.entity';
import { PaymentRecordEntity } from '../../database/entities/payment-record.entity';
import { NotificationEntity } from '../../database/entities/notification.entity';
import { StudentEntity, StudentLifecycleStatus } from '../../database/entities/student.entity';
import { UserRole } from '../../database/entities/user.entity';
import { todayInAppTimezone } from '../../common/local-date';
import { FcmService } from '../fcm/fcm.service';
import { CreateConceptDto } from './dto/create-concept.dto';
import { CreateDebtDto } from './dto/create-debt.dto';
import { RejectVoucherDto } from './dto/reject-voucher.dto';
import { UpdateConceptDto } from './dto/update-concept.dto';
import { UploadVoucherDto } from './dto/upload-voucher.dto';

export type DebtAdminListItem = {
  id: string;
  studentId: string;
  conceptId: string;
  amount: string;
  dueDate: string;
  status: PaymentStatus;
  description: string | null;
  voucherPath: string | null;
  uploadedAt: string | null;
  verifiedAt: string | null;
  notes: string | null;
  studentName: string;
  matricula: string;
  conceptName: string;
};

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(PaymentConceptEntity)
    private readonly conceptsRepository: Repository<PaymentConceptEntity>,
    @InjectRepository(DebtEntity)
    private readonly debtsRepository: Repository<DebtEntity>,
    @InjectRepository(DebtAdjustmentEntity)
    private readonly debtAdjustmentsRepository: Repository<DebtAdjustmentEntity>,
    @InjectRepository(PaymentRecordEntity)
    private readonly paymentsRepository: Repository<PaymentRecordEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentsRepository: Repository<StudentEntity>,
    @InjectRepository(ParentEntity)
    private readonly parentsRepository: Repository<ParentEntity>,
    @InjectRepository(AdministrativeStaffEntity)
    private readonly staffRepository: Repository<AdministrativeStaffEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notificationsRepository: Repository<NotificationEntity>,
    private readonly fcmService: FcmService
  ) {}

  /** Lista conceptos de pago de la escuela indicada y los conceptos globales (school_id IS NULL). */
  async listConcepts(includeInactive = false, schoolId?: string | null) {
    const qb = this.conceptsRepository.createQueryBuilder('c').orderBy('c.name', 'ASC');
    if (!includeInactive) {
      qb.andWhere('c.is_active = :active', { active: true });
    }
    if (schoolId) {
      qb.andWhere('(c.school_id = :schoolId OR c.school_id IS NULL)', { schoolId });
    }
    return qb.getMany();
  }

  /**
   * Crea conceptos plantilla (`is_base`) solo si la lista está vacía (inscripciones, mensualidades).
   */
  async ensureBaseConceptTemplates(): Promise<{ created: number; skipped: boolean }> {
    const existing = await this.conceptsRepository.count({ where: { isBase: true } });
    if (existing > 0) return { created: 0, skipped: true };
    const templates = [
      {
        name: 'Inscripción / reinscripción',
        description: 'Concepto plantilla; ajuste montos según su reglamento.',
        defaultAmount: '0',
        isRecurring: false,
        recurrencePeriod: null as string | null
      },
      {
        name: 'Colegiatura mensual',
        description: 'Plantilla para mensualidades del ciclo escolar.',
        defaultAmount: '0',
        isRecurring: true,
        recurrencePeriod: 'MONTHLY'
      },
      {
        name: 'Material y otros',
        description: 'Uniformes, materiales u otros cargos puntuales.',
        defaultAmount: '0',
        isRecurring: false,
        recurrencePeriod: null as string | null
      }
    ];
    let created = 0;
    for (const t of templates) {
      await this.conceptsRepository.save(
        this.conceptsRepository.create({
          name: t.name,
          description: t.description,
          defaultAmount: t.defaultAmount,
          isRecurring: t.isRecurring,
          recurrencePeriod: t.recurrencePeriod,
          isBase: true,
          isActive: true
        })
      );
      created += 1;
    }
    return { created, skipped: false };
  }

  async createConcept(dto: CreateConceptDto) {
    const taken = await this.conceptsRepository.findOne({ where: { name: dto.name } });
    if (taken) throw new ConflictException('Ya existe un concepto con ese nombre');
    const entity = this.conceptsRepository.create({
      name: dto.name,
      description: dto.description ?? null,
      defaultAmount: String(dto.defaultAmount),
      isRecurring: dto.isRecurring ?? false,
      recurrencePeriod: dto.recurrencePeriod ?? null,
      isBase: false,
      isActive: true
    });
    return this.conceptsRepository.save(entity);
  }

  async updateConcept(id: string, dto: UpdateConceptDto) {
    const c = await this.conceptsRepository.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Concepto no encontrado');
    if (dto.name !== undefined && dto.name !== c.name) {
      const clash = await this.conceptsRepository.findOne({ where: { name: dto.name } });
      if (clash) throw new ConflictException('Ya existe un concepto con ese nombre');
      c.name = dto.name;
    }
    if (dto.description !== undefined) {
      c.description = dto.description.trim() === '' ? null : dto.description;
    }
    if (dto.defaultAmount !== undefined) c.defaultAmount = String(dto.defaultAmount);
    if (dto.isRecurring !== undefined) c.isRecurring = dto.isRecurring;
    if (dto.recurrencePeriod !== undefined) {
      c.recurrencePeriod = dto.recurrencePeriod.trim() === '' ? null : dto.recurrencePeriod;
    }
    if (dto.isActive !== undefined) c.isActive = dto.isActive;
    return this.conceptsRepository.save(c);
  }

  async deleteConcept(id: string): Promise<{ ok: true }> {
    const c = await this.conceptsRepository.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Concepto no encontrado');
    const linked = await this.debtsRepository.count({ where: { conceptId: id } });
    if (linked > 0) {
      throw new ConflictException(
        `No se puede eliminar: hay ${linked} obligación(es) de pago vinculadas a este concepto. ` +
          'Desactívelo o gestione primero esas deudas.'
      );
    }
    await this.conceptsRepository.delete(id);
    return { ok: true };
  }

  async createDebt(dto: CreateDebtDto, userId: string, role: UserRole) {
    const student = await this.studentsRepository.findOne({ where: { id: dto.studentId } });
    if (!student) throw new NotFoundException('Estudiante no encontrado');
    if (student.lifecycleStatus !== StudentLifecycleStatus.ACTIVO) {
      throw new BadRequestException('Solo se pueden registrar deudas para estudiantes ACTIVO');
    }
    if (role === UserRole.ADMINISTRATIVO) {
      await this.assertAdministrativeCanAccessStudent(userId, dto.studentId);
    }
    const concept = await this.conceptsRepository.findOne({ where: { id: dto.conceptId } });
    if (!concept) throw new NotFoundException('Concepto no encontrado');
    const debt = this.debtsRepository.create({
      studentId: dto.studentId,
      conceptId: dto.conceptId,
      amount: String(dto.amount),
      dueDate: dto.dueDate.slice(0, 10),
      status: PaymentStatus.PENDIENTE,
      description: dto.description ?? null
    });
    return this.debtsRepository.save(debt);
  }

  async listMyDebtsAsParent(userId: string) {
    const parent = await this.parentsRepository.findOne({ where: { userId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');
    const rows = await this.debtsRepository
      .createQueryBuilder('d')
      .innerJoin('students', 's', 's.id = d.student_id')
      .innerJoin('users', 'su', 'su.id = s.user_id')
      .innerJoin('payment_concepts', 'pc', 'pc.id = d.concept_id')
      .innerJoin('student_parents', 'sp', 'sp.student_id = s.id AND sp.parent_id = :pid', {
        pid: parent.id
      })
      .select([
        'd.id AS id',
        'd.student_id AS "studentId"',
        'su.full_name AS "studentName"',
        'd.concept_id AS "conceptId"',
        'pc.name AS "conceptName"',
        'pc.description AS "conceptDescription"',
        'd.amount::text AS amount',
        'd.due_date AS "dueDate"',
        'd.status AS status',
        'd.description AS description',
        'd.voucher_path AS "voucherPath"',
        'd.uploaded_at AS "uploadedAt"',
        'd.verified_at AS "verifiedAt"',
        'd.notes AS notes',
        'd.created_at AS "createdAt"'
      ])
      .orderBy('d.due_date', 'ASC')
      .getRawMany<{
        id: string;
        studentId: string;
        studentName: string;
        conceptId: string;
        conceptName: string;
        conceptDescription: string | null;
        amount: string;
        dueDate: string;
        status: PaymentStatus;
        description: string | null;
        voucherPath: string | null;
        uploadedAt: Date | null;
        verifiedAt: Date | null;
        notes: string | null;
        createdAt: Date;
      }>();
    return rows.map((r) => ({
      ...r,
      dueDate:
        typeof r.dueDate === 'string'
          ? r.dueDate.slice(0, 10)
          : new Date(r.dueDate as unknown as Date).toISOString().slice(0, 10),
      uploadedAt: r.uploadedAt ? new Date(r.uploadedAt).toISOString() : null,
      verifiedAt: r.verifiedAt ? new Date(r.verifiedAt).toISOString() : null,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null
    }));
  }

  async listDebtsForAdmin(
    status: PaymentStatus | undefined,
    page = 1,
    limit = 30,
    userId?: string,
    role?: UserRole
  ): Promise<{
    data: DebtAdminListItem[];
    meta: { total: number; page: number; limit: number; pages: number };
  }> {
    const take = Math.min(Math.max(limit, 1), 200);
    const skip = (Math.max(page, 1) - 1) * take;

    const qb = this.debtsRepository
      .createQueryBuilder('d')
      .innerJoin('students', 's', 's.id = d.student_id')
      .innerJoin('users', 'su', 'su.id = s.user_id')
      .innerJoin('payment_concepts', 'pc', 'pc.id = d.concept_id');

    if (role === UserRole.ADMINISTRATIVO && userId) {
      qb.innerJoin('users', 'au', 'au.id = :uid', { uid: userId }).where('au.school_id = su.school_id');
    }

    if (status) {
      qb.andWhere('d.status = :st', { st: status });
    }

    const countQb = qb.clone();
    const total = await countQb.getCount();

    qb
      .select([
        'd.id AS id',
        'd.student_id AS "studentId"',
        'd.concept_id AS "conceptId"',
        'd.amount::text AS amount',
        'd.due_date AS "dueDate"',
        'd.status AS status',
        'd.description AS description',
        'd.voucher_path AS "voucherPath"',
        'd.uploaded_at AS "uploadedAt"',
        'd.verified_at AS "verifiedAt"',
        'd.notes AS notes',
        'su.full_name AS "studentName"',
        's.matricula AS matricula',
        'pc.name AS "conceptName"'
      ])
      .orderBy('d.created_at', 'DESC')
      .skip(skip)
      .take(take);

    const raw = await qb.getRawMany<
      DebtAdminListItem & {
        uploadedAt: Date | null;
        verifiedAt: Date | null;
        dueDate: string | Date;
      }
    >();

    const data: DebtAdminListItem[] = raw.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      conceptId: r.conceptId,
      amount: r.amount,
      dueDate:
        typeof r.dueDate === 'string'
          ? r.dueDate.slice(0, 10)
          : new Date(r.dueDate as unknown as Date).toISOString().slice(0, 10),
      status: r.status as PaymentStatus,
      description: r.description,
      voucherPath: r.voucherPath,
      uploadedAt: r.uploadedAt ? new Date(r.uploadedAt).toISOString() : null,
      verifiedAt: r.verifiedAt ? new Date(r.verifiedAt).toISOString() : null,
      notes: r.notes,
      studentName: r.studentName,
      matricula: r.matricula,
      conceptName: r.conceptName
    }));

    return {
      data,
      meta: { total, page: Math.max(page, 1), limit: take, pages: Math.ceil(total / take) }
    };
  }

  async listPendingVerification(page = 1, limit = 30, userId?: string, role?: UserRole) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    let data: DebtEntity[] = [];
    let total = 0;
    if (role === UserRole.ADMINISTRATIVO && userId) {
      const qb = this.debtsRepository
        .createQueryBuilder('d')
        .innerJoin('students', 's', 's.id = d.student_id')
        .innerJoin('users', 'su', 'su.id = s.user_id')
        .innerJoin('users', 'au', 'au.id = :uid', { uid: userId })
        .where('au.school_id = su.school_id')
        .andWhere('d.status = :st', { st: PaymentStatus.PENDIENTE })
        .andWhere('d.voucher_path IS NOT NULL')
        .andWhere('d.verified_at IS NULL')
        .orderBy('d.uploadedAt', 'DESC')
        .addOrderBy('d.dueDate', 'ASC')
        .skip(skip)
        .take(take);
      [data, total] = await qb.getManyAndCount();
    } else {
      const qb = this.debtsRepository
        .createQueryBuilder('d')
        .where('d.status = :st', { st: PaymentStatus.PENDIENTE })
        .andWhere('d.voucher_path IS NOT NULL')
        .andWhere('d.verified_at IS NULL')
        .orderBy('d.uploadedAt', 'DESC')
        .addOrderBy('d.dueDate', 'ASC')
        .skip(skip)
        .take(take);
      [data, total] = await qb.getManyAndCount();
    }
    return {
      data,
      meta: { total, page: Math.max(page, 1), limit: take },
      note: 'Solo obligaciones con comprobante cargado y aún no verificadas por administración.'
    };
  }

  async uploadVoucher(debtId: string, userId: string, dto: UploadVoucherDto) {
    const parent = await this.parentsRepository.findOne({ where: { userId } });
    if (!parent) throw new ForbiddenException('Solo padres pueden cargar comprobantes');
    const debt = await this.debtsRepository.findOne({ where: { id: debtId } });
    if (!debt) throw new NotFoundException('Deuda no encontrada');
    const rejectedAttempts = this.rejectedAttemptsFromDebtNotes(debt.notes);
    if (rejectedAttempts >= 3) {
      throw new BadRequestException('Has alcanzado el máximo de intentos. Contacta a administración.');
    }
    if (debt.status === PaymentStatus.COMPROBANTE_RECHAZADO) {
      debt.status = PaymentStatus.PENDIENTE;
    }
    if (debt.status !== PaymentStatus.PENDIENTE) {
      throw new BadRequestException('La deuda no admite comprobante en este estado');
    }
    this.assertDebtDueDateNotPastForParentVoucherUpload(debt);
    const allowed = await this.debtsRepository
      .createQueryBuilder('d')
      .innerJoin('students', 's', 's.id = d.student_id')
      .innerJoin('student_parents', 'sp', 'sp.student_id = s.id AND sp.parent_id = :pid', {
        pid: parent.id
      })
      .where('d.id = :did', { did: debtId })
      .getCount();
    if (!allowed) {
      throw new ForbiddenException('No tienes relación con el estudiante de esta deuda');
    }
    debt.voucherPath = dto.voucherPath;
    debt.uploadedByParentId = parent.id;
    debt.uploadedAt = new Date();
    const saved = await this.debtsRepository.save(debt);
    void this.notifyStaffVoucherUploaded(saved.id, debt.studentId).catch(() => undefined);
    return saved;
  }

  /** Fecha de vencimiento estrictamente anterior al día calendario actual (zona del servidor). */
  private assertDebtDueDateNotPastForParentVoucherUpload(debt: DebtEntity): void {
    const ymd = debt.dueDate?.toString().slice(0, 10) ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return;
    const today = new Date();
    const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (ymd < todayYmd) {
      throw new BadRequestException(
        'Este pago está vencido. Comuníquese con la institución si requiere generar el cobro nuevamente.'
      );
    }
  }

  private async notifyStaffVoucherUploaded(debtId: string, studentId: string): Promise<void> {
    const schoolRows = await this.studentsRepository.manager.query<{ school_id: string | null }[]>(
      `SELECT su.school_id FROM students s INNER JOIN users su ON su.id = s.user_id WHERE s.id = $1`,
      [studentId]
    );
    const schoolId = schoolRows[0]?.school_id;
    if (!schoolId) return;

    const staffUsers = await this.studentsRepository.manager.query<{ id: string }[]>(
      `SELECT id FROM users
       WHERE (role = 'ADMINISTRATIVO' AND school_id = $1)
          OR role = 'ADMIN'`,
      [schoolId]
    );
    const title = 'Nuevo comprobante de pago';
    const message = `Un padre/tutor cargó un comprobante (deuda ${debtId.slice(0, 8)}…). Revise Finanzas para verificar.`;
    for (const u of staffUsers) {
      const n = this.notificationsRepository.create({
        userId: u.id,
        noticeId: null,
        title,
        message,
        deliveryStatus: 'SENT'
      });
      const savedN = await this.notificationsRepository.save(n);
      void this.fcmService
        .sendPushToUser(u.id, title, message, {
          type: 'payment_voucher',
          notificationId: savedN.id,
          debtId,
          deepLink: '/app/modulos/finanzas'
        })
        .catch(() => undefined);
    }
  }

  async verifyDebt(debtId: string, userId: string, role: UserRole) {
    if (role !== UserRole.ADMIN && role !== UserRole.ADMINISTRATIVO) {
      throw new ForbiddenException('Solo personal autorizado puede verificar pagos');
    }
    const debt = await this.debtsRepository.findOne({ where: { id: debtId } });
    if (!debt) throw new NotFoundException('Deuda no encontrada');
    if (role === UserRole.ADMINISTRATIVO) {
      await this.assertAdministrativeCanAccessStudent(userId, debt.studentId);
    }
    if (debt.status !== PaymentStatus.PENDIENTE) {
      throw new BadRequestException('La deuda ya fue procesada');
    }
    if (!debt.voucherPath) {
      throw new BadRequestException('Falta comprobante cargado por el padre');
    }
    const staff = await this.staffRepository.findOne({ where: { userId } });
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    debt.status = PaymentStatus.PAGADO;
    debt.notes = null;
    debt.verifiedAt = now;
    debt.verifiedByAdminId = staff?.id ?? null;
    const payment = this.paymentsRepository.create({
      debtId: debt.id,
      paymentDate: today,
      amountPaid: debt.amount,
      paymentMethod: 'COMPROBANTE_MANUAL',
      voucherPath: debt.voucherPath,
      verifiedByAdminId: staff?.id ?? null,
      verifiedAt: now,
      notes: 'Verificado desde Escuela Pass'
    });
    await this.debtsRepository.save(debt);
    const savedPayment = await this.paymentsRepository.save(payment);
    const studentName = await this.studentDisplayNameForPayment(debt.studentId);
    void this.notifyParentUsersAboutDebt(
      debt.studentId,
      'Pago verificado',
      `Se verificó su comprobante: la obligación de ${studentName} quedó registrada como pagada.`,
      {
        type: 'payment_verified',
        debtId: debt.id,
        deepLink: '/app/modulos/finanzas'
      }
    ).catch(() => undefined);
    return {
      message: 'Pago verificado y registrado',
      debtId: debt.id,
      paymentId: savedPayment.id
    };
  }

  async rejectVoucher(debtId: string, userId: string, role: UserRole, dto: RejectVoucherDto) {
    if (role !== UserRole.ADMIN && role !== UserRole.ADMINISTRATIVO) {
      throw new ForbiddenException('Solo personal autorizado puede revisar comprobantes');
    }
    const debt = await this.debtsRepository.findOne({ where: { id: debtId } });
    if (!debt) throw new NotFoundException('Deuda no encontrada');
    if (role === UserRole.ADMINISTRATIVO) {
      await this.assertAdministrativeCanAccessStudent(userId, debt.studentId);
    }
    if (debt.status !== PaymentStatus.PENDIENTE) {
      throw new BadRequestException('Solo se puede rechazar el comprobante en obligaciones pendientes de verificación.');
    }
    if (!debt.voucherPath) {
      throw new BadRequestException('No hay comprobante cargado para revisar.');
    }
    if (debt.verifiedAt) {
      throw new BadRequestException('Este comprobante ya fue verificado.');
    }
    const reason = dto.reason.trim();
    const rejectedAttempts = this.rejectedAttemptsFromDebtNotes(debt.notes) + 1;
    debt.status = PaymentStatus.COMPROBANTE_RECHAZADO;
    // TODO Fase 7: agregar columna rejected_attempts o tabla payment_receipts; se conserva el contador en notes.
    debt.notes = `[rejected_attempts=${rejectedAttempts}] ${reason}`;
    await this.debtsRepository.save(debt);
    void this.notifyParentUsersAboutDebt(
      debt.studentId,
      'Comprobante no aceptado',
      `La institución revisó su comprobante y requiere corrección o un nuevo archivo: ${reason}`,
      {
        type: 'payment_voucher_rejected',
        debtId: debt.id,
        deepLink: '/app/modulos/finanzas'
      }
    ).catch(() => undefined);
    return { message: 'Comprobante rechazado; se notificó a la familia.', debtId: debt.id };
  }

  async listDebtAdjustments(
    page = 1,
    limit = 50,
    userId?: string,
    role?: UserRole,
    schoolId?: string
  ) {
    const take = Math.min(Math.max(limit, 1), 200);
    const skip = (Math.max(page, 1) - 1) * take;
    const qb = this.debtAdjustmentsRepository
      .createQueryBuilder('da')
      .innerJoin('debts', 'd', 'd.id = da.debt_id')
      .innerJoin('students', 's', 's.id = d.student_id')
      .innerJoin('users', 'su', 'su.id = s.user_id')
      .leftJoin('users', 'cu', 'cu.id = da.changed_by_user_id')
      .select([
        'da.id AS id',
        'da.debt_id AS "debtId"',
        'da.school_id AS "schoolId"',
        'da.action_type AS "actionType"',
        'da.previous_amount::text AS "previousAmount"',
        'da.delta_amount::text AS "deltaAmount"',
        'da.next_amount::text AS "nextAmount"',
        'da.reason AS reason',
        'da.policy_cycle_date AS "policyCycleDate"',
        'da.changed_by_user_id AS "changedByUserId"',
        'da.metadata AS metadata',
        'da.created_at AS "createdAt"',
        'su.full_name AS "studentName"',
        's.matricula AS matricula',
        'cu.full_name AS "changedByName"'
      ])
      .orderBy('da.created_at', 'DESC')
      .skip(skip)
      .take(take);
    if (role === UserRole.ADMINISTRATIVO && userId) {
      qb.innerJoin('users', 'au', 'au.id = :uid', { uid: userId }).andWhere('au.school_id = da.school_id');
    } else if (schoolId?.trim()) {
      qb.andWhere('da.school_id = :sid', { sid: schoolId.trim() });
    }
    const countQb = qb.clone();
    const total = await countQb.getCount();
    const data = await qb.getRawMany();
    return {
      data,
      meta: { total, page: Math.max(page, 1), limit: take, pages: Math.ceil(total / take) }
    };
  }

  async runDebtPolicies(changedByUserId?: string | null) {
    const rows = await this.debtsRepository
      .createQueryBuilder('d')
      .innerJoin('students', 's', 's.id = d.student_id')
      .innerJoin('users', 'su', 'su.id = s.user_id')
      .select([
        'd.id AS id',
        'd.student_id AS "studentId"',
        'd.amount::text AS amount',
        'd.due_date AS "dueDate"',
        'd.status AS status',
        'su.school_id AS "schoolId"'
      ])
      .where('d.status IN (:...statuses)', {
        statuses: [PaymentStatus.PENDIENTE, PaymentStatus.VENCIDO]
      })
      .getRawMany<{
        id: string;
        studentId: string;
        amount: string;
        dueDate: string;
        status: PaymentStatus;
        schoolId: string | null;
      }>();
    const today = todayInAppTimezone();
    let markedOverdue = 0;
    let lateFeeApplied = 0;
    for (const row of rows) {
      if (!row.schoolId) continue;
      const dueDateYmd =
        typeof row.dueDate === 'string'
          ? row.dueDate.slice(0, 10)
          : new Date(row.dueDate as unknown as Date).toISOString().slice(0, 10);
      if (dueDateYmd >= today) continue;
      if (row.status !== PaymentStatus.VENCIDO) {
        await this.debtsRepository.update({ id: row.id }, { status: PaymentStatus.VENCIDO });
        await this.appendDebtAdjustment({
          debtId: row.id,
          schoolId: row.schoolId,
          actionType: DebtAdjustmentActionType.STATUS_CHANGE,
          previousAmount: row.amount,
          deltaAmount: '0',
          nextAmount: row.amount,
          reason: 'Marcada como vencida por política automática',
          changedByUserId: changedByUserId ?? null,
          policyCycleDate: today,
          metadata: { fromStatus: row.status, toStatus: PaymentStatus.VENCIDO }
        });
        markedOverdue += 1;
      }
      const existingLateFee = await this.debtAdjustmentsRepository.findOne({
        where: { debtId: row.id, actionType: DebtAdjustmentActionType.LATE_FEE }
      });
      if (existingLateFee) continue;
      const prev = Number.parseFloat(row.amount);
      if (Number.isNaN(prev) || prev <= 0) continue;
      const fee = Number((prev * 0.05).toFixed(2));
      if (fee <= 0) continue;
      const next = Number((prev + fee).toFixed(2));
      await this.debtsRepository.update({ id: row.id }, { amount: next.toFixed(2), status: PaymentStatus.VENCIDO });
      await this.appendDebtAdjustment({
        debtId: row.id,
        schoolId: row.schoolId,
        actionType: DebtAdjustmentActionType.LATE_FEE,
        previousAmount: prev.toFixed(2),
        deltaAmount: fee.toFixed(2),
        nextAmount: next.toFixed(2),
        reason: 'Recargo automático por mora (5%)',
        changedByUserId: changedByUserId ?? null,
        policyCycleDate: today,
        metadata: { percent: 5 }
      });
      lateFeeApplied += 1;
    }
    return { checked: rows.length, markedOverdue, lateFeeApplied };
  }

  async applyArrangement(debtId: string, userId: string, role: UserRole, dto: { discountPercent: number; reason: string }) {
    if (role !== UserRole.ADMIN && role !== UserRole.ADMINISTRATIVO) {
      throw new ForbiddenException('Solo personal autorizado puede aplicar convenios');
    }
    const debt = await this.debtsRepository.findOne({ where: { id: debtId } });
    if (!debt) throw new NotFoundException('Deuda no encontrada');
    if (role === UserRole.ADMINISTRATIVO) {
      await this.assertAdministrativeCanAccessStudent(userId, debt.studentId);
    }
    const percent = Number(dto.discountPercent);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      throw new BadRequestException('El porcentaje de descuento debe estar entre 0 y 100');
    }
    const prev = Number.parseFloat(debt.amount);
    if (Number.isNaN(prev) || prev <= 0) {
      throw new BadRequestException('Monto de deuda inválido para aplicar convenio');
    }
    const discount = Number(((prev * percent) / 100).toFixed(2));
    const next = Number(Math.max(0, prev - discount).toFixed(2));
    debt.amount = next.toFixed(2);
    if (debt.status === PaymentStatus.VENCIDO) {
      debt.status = PaymentStatus.PENDIENTE;
    }
    debt.notes = dto.reason.trim();
    await this.debtsRepository.save(debt);
    const schoolId = await this.resolveSchoolIdForDebt(debt.id);
    await this.appendDebtAdjustment({
      debtId: debt.id,
      schoolId,
      actionType: DebtAdjustmentActionType.ARRANGEMENT,
      previousAmount: prev.toFixed(2),
      deltaAmount: (-discount).toFixed(2),
      nextAmount: next.toFixed(2),
      reason: `Convenio aplicado (${percent.toFixed(2)}%): ${dto.reason.trim()}`,
      changedByUserId: userId,
      policyCycleDate: null,
      metadata: { discountPercent: percent }
    });
    return { message: 'Convenio aplicado', debtId: debt.id, previousAmount: prev.toFixed(2), nextAmount: next.toFixed(2) };
  }

  private async studentDisplayNameForPayment(studentId: string): Promise<string> {
    const row = await this.studentsRepository.manager.query<{ full_name: string | null }[]>(
      `SELECT u.full_name FROM students s INNER JOIN users u ON u.id = s.user_id WHERE s.id = $1 LIMIT 1`,
      [studentId]
    );
    const n = row[0]?.full_name?.trim();
    return n || 'el estudiante';
  }

  private rejectedAttemptsFromDebtNotes(notes: string | null | undefined): number {
    const match = notes?.match(/\[rejected_attempts=(\d+)\]/);
    if (!match) return 0;
    const n = Number.parseInt(match[1], 10);
    return Number.isFinite(n) ? n : 0;
  }

  private async notifyParentUsersAboutDebt(
    studentId: string,
    title: string,
    message: string,
    fcmPayload: Record<string, string>
  ): Promise<void> {
    const rows = await this.studentsRepository.manager.query<{ user_id: string }[]>(
      `SELECT DISTINCT u.id AS user_id
       FROM student_parents sp
       INNER JOIN parents p ON p.id = sp.parent_id
       INNER JOIN users u ON u.id = p.user_id
       WHERE sp.student_id = $1`,
      [studentId]
    );
    for (const row of rows) {
      const n = this.notificationsRepository.create({
        userId: row.user_id,
        noticeId: null,
        title,
        message,
        deliveryStatus: 'SENT'
      });
      const savedN = await this.notificationsRepository.save(n);
      void this.fcmService
        .sendPushToUser(row.user_id, title, message, {
          ...fcmPayload,
          notificationId: savedN.id
        })
        .catch(() => undefined);
    }
  }

  private async assertAdministrativeCanAccessStudent(userId: string, studentId: string): Promise<void> {
    const rows = await this.studentsRepository.manager.query<{ ok: boolean }[]>(
      `SELECT EXISTS (
         SELECT 1
         FROM users au
         JOIN students s ON s.id = $2
         JOIN users su ON su.id = s.user_id
         WHERE au.id = $1
           AND au.role = 'ADMINISTRATIVO'
           AND au.school_id IS NOT NULL
           AND au.school_id = su.school_id
      ) AS ok`,
      [userId, studentId]
    );
    if (!rows[0]?.ok) {
      throw new ForbiddenException('No autorizado en esta institución');
    }
  }

  private async resolveSchoolIdForDebt(debtId: string): Promise<string> {
    const rows = await this.debtsRepository.manager.query<{ school_id: string | null }[]>(
      `SELECT su.school_id
       FROM debts d
       INNER JOIN students s ON s.id = d.student_id
       INNER JOIN users su ON su.id = s.user_id
       WHERE d.id = $1
       LIMIT 1`,
      [debtId]
    );
    const schoolId = rows[0]?.school_id?.trim();
    if (!schoolId) throw new BadRequestException('No se pudo resolver la escuela de la deuda');
    return schoolId;
  }

  private async appendDebtAdjustment(payload: {
    debtId: string;
    schoolId: string;
    actionType: DebtAdjustmentActionType;
    previousAmount: string;
    deltaAmount: string;
    nextAmount: string;
    reason: string;
    changedByUserId: string | null;
    policyCycleDate: string | null;
    metadata?: Record<string, unknown> | null;
  }) {
    const row = this.debtAdjustmentsRepository.create({
      debtId: payload.debtId,
      schoolId: payload.schoolId,
      actionType: payload.actionType,
      previousAmount: payload.previousAmount,
      deltaAmount: payload.deltaAmount,
      nextAmount: payload.nextAmount,
      reason: payload.reason,
      changedByUserId: payload.changedByUserId,
      policyCycleDate: payload.policyCycleDate,
      metadata: payload.metadata ?? null
    });
    await this.debtAdjustmentsRepository.save(row);
  }
}
