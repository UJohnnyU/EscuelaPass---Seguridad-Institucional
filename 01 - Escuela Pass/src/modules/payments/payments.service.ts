import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdministrativeStaffEntity } from '../../database/entities/administrative-staff.entity';
import { DebtEntity, PaymentStatus } from '../../database/entities/debt.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { PaymentConceptEntity } from '../../database/entities/payment-concept.entity';
import { PaymentRecordEntity } from '../../database/entities/payment-record.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { UserRole } from '../../database/entities/user.entity';
import { CreateConceptDto } from './dto/create-concept.dto';
import { CreateDebtDto } from './dto/create-debt.dto';
import { UploadVoucherDto } from './dto/upload-voucher.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(PaymentConceptEntity)
    private readonly conceptsRepository: Repository<PaymentConceptEntity>,
    @InjectRepository(DebtEntity)
    private readonly debtsRepository: Repository<DebtEntity>,
    @InjectRepository(PaymentRecordEntity)
    private readonly paymentsRepository: Repository<PaymentRecordEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentsRepository: Repository<StudentEntity>,
    @InjectRepository(ParentEntity)
    private readonly parentsRepository: Repository<ParentEntity>,
    @InjectRepository(AdministrativeStaffEntity)
    private readonly staffRepository: Repository<AdministrativeStaffEntity>
  ) {}

  async listConcepts(includeInactive = false) {
    const qb = this.conceptsRepository.createQueryBuilder('c').orderBy('c.name', 'ASC');
    if (!includeInactive) {
      qb.andWhere('c.is_active = :active', { active: true });
    }
    return qb.getMany();
  }

  async createConcept(dto: CreateConceptDto) {
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

  async createDebt(dto: CreateDebtDto) {
    const student = await this.studentsRepository.findOne({ where: { id: dto.studentId } });
    if (!student) throw new NotFoundException('Estudiante no encontrado');
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
    return this.debtsRepository
      .createQueryBuilder('d')
      .innerJoin('students', 's', 's.id = d.student_id')
      .innerJoin('student_parents', 'sp', 'sp.student_id = s.id AND sp.parent_id = :pid', {
        pid: parent.id
      })
      .orderBy('d.due_date', 'ASC')
      .getMany();
  }

  async listDebtsForAdmin(status: PaymentStatus | undefined, page = 1, limit = 30) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const where = status ? { status } : {};
    const [data, total] = await this.debtsRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take
    });
    return {
      data,
      meta: { total, page: Math.max(page, 1), limit: take, pages: Math.ceil(total / take) }
    };
  }

  async listPendingVerification(page = 1, limit = 30) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const [data, total] = await this.debtsRepository.findAndCount({
      where: { status: PaymentStatus.PENDIENTE },
      order: { uploadedAt: 'DESC', dueDate: 'ASC' },
      skip,
      take
    });
    const withVoucher = data.filter((d) => d.voucherPath != null);
    return {
      data: withVoucher.length ? withVoucher : data,
      meta: { total, page: Math.max(page, 1), limit: take },
      note: 'Prioriza filas con comprobante (voucher_path); si no hay, muestra pendientes sin comprobante.'
    };
  }

  async uploadVoucher(debtId: string, userId: string, dto: UploadVoucherDto) {
    const parent = await this.parentsRepository.findOne({ where: { userId } });
    if (!parent) throw new ForbiddenException('Solo padres pueden cargar comprobantes');
    const debt = await this.debtsRepository.findOne({ where: { id: debtId } });
    if (!debt) throw new NotFoundException('Deuda no encontrada');
    if (debt.status !== PaymentStatus.PENDIENTE) {
      throw new BadRequestException('La deuda no admite comprobante en este estado');
    }
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
    return this.debtsRepository.save(debt);
  }

  async verifyDebt(debtId: string, userId: string, role: UserRole) {
    if (role !== UserRole.ADMIN && role !== UserRole.ADMINISTRATIVO) {
      throw new ForbiddenException('Solo personal autorizado puede verificar pagos');
    }
    const debt = await this.debtsRepository.findOne({ where: { id: debtId } });
    if (!debt) throw new NotFoundException('Deuda no encontrada');
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
    return {
      message: 'Pago verificado y registrado',
      debtId: debt.id,
      paymentId: savedPayment.id
    };
  }
}
