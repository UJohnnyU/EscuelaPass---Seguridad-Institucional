import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessEventEntity } from '../../database/entities/access-event.entity';
import { AttendanceRecordEntity } from '../../database/entities/attendance-record.entity';
import { CircuitRequestEntity, CircuitStatus } from '../../database/entities/circuit-request.entity';
import { DebtEntity, PaymentStatus } from '../../database/entities/debt.entity';
import { PaymentRecordEntity } from '../../database/entities/payment-record.entity';
import { TeacherEntity, TeacherLifecycleStatus } from '../../database/entities/teacher.entity';
import { UserRole } from '../../database/entities/user.entity';
import { SchoolCalendarService } from '../school-calendar/school-calendar.service';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(AccessEventEntity)
    private readonly accessEventsRepository: Repository<AccessEventEntity>,
    @InjectRepository(AttendanceRecordEntity)
    private readonly attendanceRepository: Repository<AttendanceRecordEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachersRepository: Repository<TeacherEntity>,
    @InjectRepository(DebtEntity)
    private readonly debtsRepository: Repository<DebtEntity>,
    @InjectRepository(PaymentRecordEntity)
    private readonly paymentsRepository: Repository<PaymentRecordEntity>,
    @InjectRepository(CircuitRequestEntity)
    private readonly circuitRepository: Repository<CircuitRequestEntity>,
    private readonly schoolCalendarService: SchoolCalendarService
  ) {}

  async attendanceToday(groupId: string, userId: string, role: UserRole, dateStr?: string) {
    const date = dateStr?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    await this.assertCanViewGroup(userId, role, groupId);

    const cal = await this.schoolCalendarService.getNonInstructionalForGroupDate(date, groupId);

    const rows = await this.attendanceRepository
      .createQueryBuilder('a')
      .innerJoin('students', 's', 's.id = a.student_id')
      .where('s.group_id = :gid', { gid: groupId })
      .andWhere('a.attendance_date = :d', { d: date })
      .getMany();

    const total = rows.length;
    const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      date,
      groupId,
      nonInstructionalDay: cal.nonInstructional,
      reasons: cal.reasons.length ? cal.reasons : undefined,
      totalRecords: total,
      byStatus,
      data: rows
    };
  }

  async paymentsPending(schoolId?: string) {
    const sid = schoolId?.trim();
    const pendingQb = this.debtsRepository
      .createQueryBuilder('d')
      .where('d.status = :st', { st: PaymentStatus.PENDIENTE });
    if (sid) pendingQb.innerJoin('students', 's', 's.id = d.student_id AND s.school_id = :sid', { sid });
    const totalPending = await pendingQb.getCount();
    const voucherQb = this.debtsRepository
      .createQueryBuilder('d')
      .where('d.status = :st', { st: PaymentStatus.PENDIENTE })
      .andWhere('d.voucher_path IS NOT NULL');
    if (sid) voucherQb.innerJoin('students', 's', 's.id = d.student_id AND s.school_id = :sid', { sid });
    const pendingWithVoucher = await voucherQb.getCount();

    const latestQb = this.debtsRepository
      .createQueryBuilder('d')
      .where('d.status = :st', { st: PaymentStatus.PENDIENTE })
      .orderBy('d.uploaded_at', 'DESC')
      .addOrderBy('d.due_date', 'ASC')
      .limit(20);
    if (sid) latestQb.innerJoin('students', 's', 's.id = d.student_id AND s.school_id = :sid', { sid });
    const latest = await latestQb.getMany();

    return {
      totalPending,
      pendingWithVoucher,
      latest
    };
  }

  async circuitToday(status: CircuitStatus | undefined, dateStr?: string, schoolId?: string) {
    const date = dateStr?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    const sid = schoolId?.trim();

    const qb = this.circuitRepository
      .createQueryBuilder('cr')
      .where('DATE(cr.request_time) = :today', { today: date })
      .orderBy('cr.request_time', 'DESC');
    if (sid) qb.innerJoin('students', 's', 's.id = cr.student_id AND s.school_id = :sid', { sid });

    if (status) qb.andWhere('cr.status = :st', { st: status });

    const data = await qb.getMany();
    const byStatus = data.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {});

    return { date, total: data.length, byStatus, data };
  }

  /**
   * RF8: Reporte de eventos de acceso (entradas/salidas) por rango de fechas.
   * Devuelve el total por día y el desglose por tipo de evento.
   */
  async accessRange(schoolId: string | undefined, fromDate: string, toDate: string) {
    const from = fromDate.slice(0, 10);
    const to = toDate.slice(0, 10);
    const sid = schoolId?.trim();

    const qb = this.accessEventsRepository
      .createQueryBuilder('ae')
      .where("DATE(ae.event_time AT TIME ZONE 'UTC') BETWEEN :from AND :to", { from, to })
      .orderBy("DATE(ae.event_time AT TIME ZONE 'UTC')", 'ASC')
      .addOrderBy('ae.event_time', 'ASC');

    if (sid) {
      qb.innerJoin('users', 'u', 'u.id = ae.user_id AND u.school_id = :sid', { sid });
    }

    const events = await qb.getMany();

    const byDay: Record<string, { total: number; ENTRY: number; EXIT: number }> = {};
    for (const ev of events) {
      const day = new Date(ev.eventTime).toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { total: 0, ENTRY: 0, EXIT: 0 };
      byDay[day].total++;
      if (ev.eventType in byDay[day]) {
        (byDay[day] as Record<string, number>)[ev.eventType]++;
      }
    }

    return {
      from,
      to,
      totalEvents: events.length,
      byDay: Object.entries(byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, counts]) => ({ date, ...counts }))
    };
  }

  /**
   * RF8: Resumen financiero de la institución (cobros, deudas pendientes, mora, colección).
   */
  async financeSummary(schoolId: string | undefined) {
    const sid = schoolId?.trim();

    const debtQb = this.debtsRepository.createQueryBuilder('d');
    if (sid) debtQb.innerJoin('students', 's', 's.id = d.student_id AND s.school_id = :sid', { sid });

    const [totalDebts, pendingDebts, overdueDebts, paidDebts] = await Promise.all([
      debtQb.clone().getCount(),
      debtQb.clone().andWhere('d.status = :st', { st: PaymentStatus.PENDIENTE }).getCount(),
      debtQb.clone()
        .andWhere('d.status = :st', { st: PaymentStatus.PENDIENTE })
        .andWhere('d.due_date < NOW()')
        .getCount(),
      debtQb.clone().andWhere('d.status = :st', { st: PaymentStatus.PAGADO }).getCount()
    ]);

    const totalPendingAmount = await debtQb.clone()
      .andWhere('d.status = :st', { st: PaymentStatus.PENDIENTE })
      .select('COALESCE(SUM(d.amount), 0)', 'total')
      .getRawOne<{ total: string }>();

    const totalCollectedQb = this.paymentsRepository.createQueryBuilder('pr');
    if (sid) {
      totalCollectedQb.innerJoin('debts', 'd2', 'd2.id = pr.debt_id')
        .innerJoin('students', 's2', 's2.id = d2.student_id AND s2.school_id = :sid', { sid });
    }
    const totalCollected = await totalCollectedQb
      .select('COALESCE(SUM(pr.amount_paid), 0)', 'total')
      .getRawOne<{ total: string }>();

    const collectionRate =
      totalDebts > 0 ? Math.round((paidDebts / totalDebts) * 100) : 0;

    return {
      totalDebts,
      pendingDebts,
      overdueDebts,
      paidDebts,
      totalPendingAmount: totalPendingAmount?.total ?? '0',
      totalCollectedAmount: totalCollected?.total ?? '0',
      collectionRatePct: collectionRate
    };
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
      if (!rows[0]?.ok) throw new ForbiddenException('No autorizado a ver reportes de este grupo');
      return;
    }
    if (role !== UserRole.DOCENTE) {
      throw new ForbiddenException('No autorizado a ver reportes de este grupo');
    }

    const teacher = await this.teachersRepository.findOne({ where: { userId } });
    if (!teacher) throw new ForbiddenException('Perfil docente no encontrado');
    if (teacher.lifecycleStatus !== TeacherLifecycleStatus.ACTIVO) {
      throw new ForbiddenException('El docente no está activo para consultar reportes de grupo');
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

