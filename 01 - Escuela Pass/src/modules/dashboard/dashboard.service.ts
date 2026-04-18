import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AccessEventEntity,
  AccessEventType
} from '../../database/entities/access-event.entity';
import {
  AttendanceRecordEntity,
  AttendanceStatus
} from '../../database/entities/attendance-record.entity';
import {
  CircuitRequestEntity,
  CircuitStatus
} from '../../database/entities/circuit-request.entity';
import { DebtEntity, PaymentStatus } from '../../database/entities/debt.entity';
import { GroupEntity } from '../../database/entities/group.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import {
  PickupRequestEntity,
  PickupRequestStatus
} from '../../database/entities/pickup-request.entity';
import { SchoolCalendarService } from '../school-calendar/school-calendar.service';

function addCalendarDays(isoDate: string, deltaDays: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(AttendanceRecordEntity)
    private readonly attendanceRepository: Repository<AttendanceRecordEntity>,
    @InjectRepository(DebtEntity)
    private readonly debtsRepository: Repository<DebtEntity>,
    @InjectRepository(CircuitRequestEntity)
    private readonly circuitRepository: Repository<CircuitRequestEntity>,
    @InjectRepository(AccessEventEntity)
    private readonly accessEventsRepository: Repository<AccessEventEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentsRepository: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachersRepository: Repository<TeacherEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupsRepository: Repository<GroupEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(PickupRequestEntity)
    private readonly visitRequestsRepository: Repository<PickupRequestEntity>,
    private readonly schoolCalendarService: SchoolCalendarService
  ) {}

  async summary(dateStr?: string) {
    const date = dateStr?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    const nonInstructionalDay = await this.schoolCalendarService.isGloballyNonInstructional(date);

    const [students, teachers, groups, usersActive] = await Promise.all([
      this.studentsRepository.count(),
      this.teachersRepository.count(),
      this.groupsRepository.count({ where: { status: true } }),
      this.usersRepository.count({ where: { status: true } })
    ]);

    const rolesRaw = await this.usersRepository
      .createQueryBuilder('u')
      .select('u.role', 'role')
      .addSelect('COUNT(*)', 'total')
      .groupBy('u.role')
      .getRawMany<{ role: UserRole; total: string }>();
    const usersByRole = rolesRaw.reduce<Record<string, number>>((acc, row) => {
      acc[row.role] = Number(row.total);
      return acc;
    }, {});

    const attendanceRaw = await this.attendanceRepository
      .createQueryBuilder('a')
      .select('a.status', 'status')
      .addSelect('COUNT(*)', 'total')
      .where('a.attendanceDate = :date', { date })
      .groupBy('a.status')
      .getRawMany<{ status: AttendanceStatus; total: string }>();
    const attendanceByStatus = attendanceRaw.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = Number(row.total);
      return acc;
    }, {});
    const attendanceTotal = Object.values(attendanceByStatus).reduce((sum, n) => sum + n, 0);

    const [pendingDebts, overdueDebts, pendingWithVoucher] = await Promise.all([
      this.debtsRepository.count({ where: { status: PaymentStatus.PENDIENTE } }),
      this.debtsRepository
        .createQueryBuilder('d')
        .where('d.status = :pending', { pending: PaymentStatus.PENDIENTE })
        .andWhere('d.dueDate < :date', { date })
        .getCount(),
      this.debtsRepository
        .createQueryBuilder('d')
        .where('d.status = :pending', { pending: PaymentStatus.PENDIENTE })
        .andWhere('d.voucherPath IS NOT NULL')
        .getCount()
    ]);

    const circuitRaw = await this.circuitRepository
      .createQueryBuilder('cr')
      .select('cr.status', 'status')
      .addSelect('COUNT(*)', 'total')
      .where('DATE(cr.requestTime) = :date', { date })
      .groupBy('cr.status')
      .getRawMany<{ status: CircuitStatus; total: string }>();
    const circuitByStatus = circuitRaw.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = Number(row.total);
      return acc;
    }, {});
    const circuitTodayTotal = Object.values(circuitByStatus).reduce((sum, n) => sum + n, 0);

    const accessRaw = await this.accessEventsRepository
      .createQueryBuilder('ae')
      .select('ae.eventType', 'eventType')
      .addSelect('COUNT(*)', 'total')
      .where('ae.eventDate = :date', { date })
      .groupBy('ae.eventType')
      .getRawMany<{ eventType: AccessEventType; total: string }>();
    const accessByType = accessRaw.reduce<Record<string, number>>((acc, row) => {
      acc[row.eventType] = Number(row.total);
      return acc;
    }, {});
    const accessTodayTotal = Object.values(accessByType).reduce((sum, n) => sum + n, 0);

    return {
      generatedAt: new Date().toISOString(),
      date,
      nonInstructionalDay,
      entities: {
        students,
        teachers,
        groups,
        usersActive,
        usersByRole
      },
      attendanceToday: {
        total: attendanceTotal,
        byStatus: attendanceByStatus
      },
      payments: {
        pendingDebts,
        overdueDebts,
        pendingWithVoucher
      },
      circuitToday: {
        total: circuitTodayTotal,
        byStatus: circuitByStatus
      },
      accessToday: {
        total: accessTodayTotal,
        byType: accessByType
      }
    };
  }

  /**
   * Panel administrativo: resumen operativo + serie de circuitos (7 días) y desglose por grupo.
   * Una sola institución por despliegue; "por grupo" sustituye granularidad multi-escuela.
   */
  async adminPanel(referenceDateStr?: string) {
    const endDate = referenceDateStr?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    const startDate = addCalendarDays(endDate, -6);

    const [summary, visitsPending, circuitDayStatusRows, circuitGroupRows] = await Promise.all([
      this.summary(endDate),
      this.visitRequestsRepository.count({ where: { status: PickupRequestStatus.PENDIENTE } }),
      this.circuitRepository
        .createQueryBuilder('cr')
        .select("TO_CHAR(DATE(cr.request_time), 'YYYY-MM-DD')", 'day')
        .addSelect('cr.status', 'status')
        .addSelect('COUNT(*)', 'cnt')
        .where('DATE(cr.request_time) BETWEEN :start AND :end', { start: startDate, end: endDate })
        .groupBy("DATE(cr.request_time)")
        .addGroupBy('cr.status')
        .orderBy('day', 'ASC')
        .getRawMany<{ day: string; status: CircuitStatus; cnt: string }>(),
      this.circuitRepository
        .createQueryBuilder('cr')
        .innerJoin('students', 's', 's.id = cr.student_id')
        .leftJoin('groups', 'g', 'g.id = s.group_id')
        .select('COALESCE(g.id::text, \'none\')', 'groupId')
        .addSelect('COALESCE(g.name, \'Sin grupo\')', 'groupName')
        .addSelect('COALESCE(g.grade, \'\')', 'grade')
        .addSelect('g.shift', 'shift')
        .addSelect('COUNT(*)', 'cnt')
        .where('DATE(cr.request_time) BETWEEN :start AND :end', { start: startDate, end: endDate })
        .groupBy('COALESCE(g.id::text, \'none\')')
        .addGroupBy('COALESCE(g.name, \'Sin grupo\')')
        .addGroupBy('COALESCE(g.grade, \'\')')
        .addGroupBy('g.shift')
        .orderBy('cnt', 'DESC')
        .getRawMany<{ groupId: string; groupName: string; grade: string; shift: string | null; cnt: string }>()
    ]);

    const byDayMap = new Map<string, { total: number; byStatus: Record<string, number> }>();
    for (const row of circuitDayStatusRows) {
      const day = String(row.day).slice(0, 10);
      if (!byDayMap.has(day)) {
        byDayMap.set(day, { total: 0, byStatus: {} });
      }
      const bucket = byDayMap.get(day)!;
      const n = Number(row.cnt);
      bucket.byStatus[row.status] = n;
      bucket.total += n;
    }

    const circuitByDay: Array<{ date: string; total: number; byStatus: Record<string, number> }> = [];
    for (let i = 0; i < 7; i++) {
      const d = addCalendarDays(startDate, i);
      const existing = byDayMap.get(d);
      circuitByDay.push({
        date: d,
        total: existing?.total ?? 0,
        byStatus: existing?.byStatus ?? {}
      });
    }

    const circuitByGroup = circuitGroupRows.map((r) => ({
      groupId: r.groupId,
      groupName: r.groupName,
      grade: r.grade || null,
      shift: r.shift,
      total: Number(r.cnt)
    }));

    return {
      referenceDate: endDate,
      window: { startDate, endDate, label: 'Últimos 7 días' },
      summary,
      visits: {
        pendingApproval: visitsPending
      },
      circuits: {
        byDay: circuitByDay,
        byGroup: circuitByGroup
      }
    };
  }
}
