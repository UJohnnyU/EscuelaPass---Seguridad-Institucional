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
import { ActivitiesService } from '../activities/activities.service';
import { MeetingsService } from '../meetings/meetings.service';
import { NoticesService } from '../notices/notices.service';
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
    private readonly schoolCalendarService: SchoolCalendarService,
    private readonly activitiesService: ActivitiesService,
    private readonly meetingsService: MeetingsService,
    private readonly noticesService: NoticesService
  ) {}

  /**
   * Snapshot para `GET /dashboards/home/:role` — mismo criterio que el home en frontend, centralizado.
   */
  async getHomeForRole(userId: string, role: UserRole): Promise<Record<string, unknown>> {
    const asOf = new Date().toISOString();
    const base = { asOf, role, schemaVersion: 1 as const };

    switch (role) {
      case UserRole.DOCENTE: {
        const [teacherAssignments, meetings, notifications] = await Promise.all([
          this.activitiesService.listTeacherAssignments(userId, role, undefined),
          this.meetingsService.listMine(userId),
          this.noticesService.listMyNotifications(userId, 1, 8)
        ]);
        return {
          ...base,
          blocks: { teacherAssignments, meetings, notifications }
        };
      }
      case UserRole.ALUMNO: {
        const [grades, meetings, notifications] = await Promise.all([
          this.activitiesService.listForStudentUser(userId, {}),
          this.meetingsService.listMine(userId),
          this.noticesService.listMyNotifications(userId, 1, 8)
        ]);
        return {
          ...base,
          blocks: { grades, meetings, notifications }
        };
      }
      case UserRole.PADRE: {
        const [meetings, notifications, childrenGrades] = await Promise.all([
          this.meetingsService.listMine(userId),
          this.noticesService.listMyNotifications(userId, 1, 8),
          this.activitiesService.listForParent(userId, {})
        ]);
        return {
          ...base,
          blocks: { meetings, notifications, childrenGrades }
        };
      }
      case UserRole.ADMIN: {
        const [operationalSummary, panel, meetings] = await Promise.all([
          this.summary(),
          this.adminPanel(),
          this.meetingsService.listForStaff({ userId, role })
        ]);
        return {
          ...base,
          blocks: { operationalSummary, panel, meetings }
        };
      }
      case UserRole.ADMINISTRATIVO: {
        const u = await this.usersRepository.findOne({
          where: { id: userId },
          select: { schoolId: true }
        });
        const sid = u?.schoolId?.trim() || undefined;
        const meetings = await this.meetingsService.listForStaff({ userId, role });
        if (!sid) {
          return {
            ...base,
            blocks: { operationalSummary: null, panel: null, meetings }
          };
        }
        const [operationalSummary, panel] = await Promise.all([
          this.summary(undefined, sid),
          this.adminPanel(undefined, undefined, sid)
        ]);
        return {
          ...base,
          blocks: { operationalSummary, panel, meetings }
        };
      }
      default:
        return { ...base, blocks: {} };
    }
  }

  async summary(dateStr?: string, schoolId?: string) {
    const date = dateStr?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    const sid = schoolId?.trim();
    const nonInstructionalDay = await this.schoolCalendarService.isGloballyNonInstructional(date);

    const teachersCountPromise = sid
      ? this.teachersRepository
          .createQueryBuilder('t')
          .innerJoin('users', 'u', 'u.id = t.user_id')
          .where('u.school_id = :sid', { sid })
          .getCount()
      : this.teachersRepository.count();
    const [students, teachers, groups, usersActive] = await Promise.all([
      this.studentsRepository.count({ where: sid ? { schoolId: sid } : undefined }),
      teachersCountPromise,
      this.groupsRepository.count({ where: sid ? { status: true, schoolId: sid } : { status: true } }),
      this.usersRepository.count({ where: sid ? { status: true, schoolId: sid } : { status: true } })
    ]);

    const rolesQb = this.usersRepository
      .createQueryBuilder('u')
      .select('u.role', 'role')
      .addSelect('COUNT(*)', 'total')
      .groupBy('u.role');
    if (sid) rolesQb.where('u.school_id = :sid', { sid });
    const rolesRaw = await rolesQb.getRawMany<{ role: UserRole; total: string }>();
    const usersByRole = rolesRaw.reduce<Record<string, number>>((acc, row) => {
      acc[row.role] = Number(row.total);
      return acc;
    }, {});

    const attendanceQb = this.attendanceRepository
      .createQueryBuilder('a')
      .innerJoin('students', 's', 's.id = a.student_id')
      .select('a.status', 'status')
      .addSelect('COUNT(*)', 'total')
      .where('a.attendanceDate = :date', { date })
      .groupBy('a.status');
    if (sid) attendanceQb.andWhere('s.school_id = :sid', { sid });
    const attendanceRaw = await attendanceQb.getRawMany<{ status: AttendanceStatus; total: string }>();
    const attendanceByStatus = attendanceRaw.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = Number(row.total);
      return acc;
    }, {});
    const attendanceTotal = Object.values(attendanceByStatus).reduce((sum, n) => sum + n, 0);

    const pendingDebtsQb = this.debtsRepository
      .createQueryBuilder('d')
      .where('d.status = :pending', { pending: PaymentStatus.PENDIENTE });
    const overdueDebtsQb = this.debtsRepository
      .createQueryBuilder('d')
      .where('d.status = :pending', { pending: PaymentStatus.PENDIENTE })
      .andWhere('d.dueDate < :date', { date });
    const pendingWithVoucherQb = this.debtsRepository
      .createQueryBuilder('d')
      .where('d.status = :pending', { pending: PaymentStatus.PENDIENTE })
      .andWhere('d.voucherPath IS NOT NULL');
    if (sid) {
      pendingDebtsQb.innerJoin('students', 's', 's.id = d.student_id AND s.school_id = :sid', { sid });
      overdueDebtsQb.innerJoin('students', 's', 's.id = d.student_id AND s.school_id = :sid', { sid });
      pendingWithVoucherQb.innerJoin('students', 's', 's.id = d.student_id AND s.school_id = :sid', { sid });
    }
    const [pendingDebts, overdueDebts, pendingWithVoucher] = await Promise.all([
      pendingDebtsQb.getCount(),
      overdueDebtsQb.getCount(),
      pendingWithVoucherQb.getCount()
    ]);

    const circuitQb = this.circuitRepository
      .createQueryBuilder('cr')
      .select('cr.status', 'status')
      .addSelect('COUNT(*)', 'total')
      .where('DATE(cr.requestTime) = :date', { date })
      .groupBy('cr.status');
    if (sid) circuitQb.innerJoin('students', 's', 's.id = cr.student_id AND s.school_id = :sid', { sid });
    const circuitRaw = await circuitQb.getRawMany<{ status: CircuitStatus; total: string }>();
    const circuitByStatus = circuitRaw.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = Number(row.total);
      return acc;
    }, {});
    const circuitTodayTotal = Object.values(circuitByStatus).reduce((sum, n) => sum + n, 0);

    const accessQb = this.accessEventsRepository
      .createQueryBuilder('ae')
      .select('ae.eventType', 'eventType')
      .addSelect('COUNT(*)', 'total')
      .where('ae.eventDate = :date', { date })
      .groupBy('ae.eventType');
    if (sid) accessQb.innerJoin('users', 'u', 'u.id = ae.user_id AND u.school_id = :sid', { sid });
    const accessRaw = await accessQb.getRawMany<{ eventType: AccessEventType; total: string }>();
    const accessByType = accessRaw.reduce<Record<string, number>>((acc, row) => {
      acc[row.eventType] = Number(row.total);
      return acc;
    }, {});
    const accessTodayTotal = Object.values(accessByType).reduce((sum, n) => sum + n, 0);

    return {
      generatedAt: new Date().toISOString(),
      date,
      schoolId: sid ?? null,
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
   * `schoolScope`: si se indica, todas las métricas quedan acotadas a esa institución (administrativo).
   */
  async adminPanel(referenceDateStr?: string, windowDaysStr?: string, schoolScope?: string | null) {
    const endDate = referenceDateStr?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    const sid = schoolScope?.trim() || undefined;
    const parsedDays = Number.parseInt(windowDaysStr ?? '7', 10);
    const windowDays = parsedDays === 15 || parsedDays === 30 ? parsedDays : 7;
    const startDate = addCalendarDays(endDate, -(windowDays - 1));
    const previousEndDate = addCalendarDays(startDate, -1);
    const previousStartDate = addCalendarDays(previousEndDate, -(windowDays - 1));
    const toMetric = (current: number, previous: number) => {
      const delta = current - previous;
      const deltaPct = previous > 0 ? Number(((delta / previous) * 100).toFixed(2)) : current > 0 ? 100 : 0;
      return { current, previous, delta, deltaPct };
    };

    const circuitDayQb = this.circuitRepository
      .createQueryBuilder('cr')
      .select("TO_CHAR(DATE(cr.request_time), 'YYYY-MM-DD')", 'day')
      .addSelect('cr.status', 'status')
      .addSelect('COUNT(*)', 'cnt')
      .where('DATE(cr.request_time) BETWEEN :start AND :end', { start: startDate, end: endDate })
      .groupBy("DATE(cr.request_time)")
      .addGroupBy('cr.status')
      .orderBy('day', 'ASC');
    if (sid) circuitDayQb.innerJoin('students', 's', 's.id = cr.student_id AND s.school_id = :sid', { sid });

    const circuitGroupQb = this.circuitRepository
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
      .orderBy('cnt', 'DESC');
    if (sid) circuitGroupQb.andWhere('s.school_id = :sid', { sid });

    const attendanceCurrentQb = this.attendanceRepository
      .createQueryBuilder('a')
      .where('a.attendanceDate BETWEEN :start AND :end', { start: startDate, end: endDate });
    if (sid)
      attendanceCurrentQb.innerJoin('students', 's', 's.id = a.student_id AND s.school_id = :sid', { sid });

    const attendancePreviousQb = this.attendanceRepository
      .createQueryBuilder('a')
      .where('a.attendanceDate BETWEEN :start AND :end', { start: previousStartDate, end: previousEndDate });
    if (sid)
      attendancePreviousQb.innerJoin('students', 's', 's.id = a.student_id AND s.school_id = :sid', { sid });

    const accessCurrentQb = this.accessEventsRepository
      .createQueryBuilder('ae')
      .where('ae.eventDate BETWEEN :start AND :end', { start: startDate, end: endDate });
    if (sid) accessCurrentQb.innerJoin('users', 'u', 'u.id = ae.user_id AND u.school_id = :sid', { sid });

    const accessPreviousQb = this.accessEventsRepository
      .createQueryBuilder('ae')
      .where('ae.eventDate BETWEEN :start AND :end', { start: previousStartDate, end: previousEndDate });
    if (sid) accessPreviousQb.innerJoin('users', 'u', 'u.id = ae.user_id AND u.school_id = :sid', { sid });

    const circuitCurrentQb = this.circuitRepository
      .createQueryBuilder('cr')
      .where('DATE(cr.request_time) BETWEEN :start AND :end', { start: startDate, end: endDate });
    if (sid) circuitCurrentQb.innerJoin('students', 's', 's.id = cr.student_id AND s.school_id = :sid', { sid });

    const circuitPreviousQb = this.circuitRepository
      .createQueryBuilder('cr')
      .where('DATE(cr.request_time) BETWEEN :start AND :end', { start: previousStartDate, end: previousEndDate });
    if (sid) circuitPreviousQb.innerJoin('students', 's', 's.id = cr.student_id AND s.school_id = :sid', { sid });

    const visitsPendingQb = this.visitRequestsRepository
      .createQueryBuilder('vr')
      .where('vr.status = :st', { st: PickupRequestStatus.PENDIENTE });
    if (sid) visitsPendingQb.innerJoin('students', 's', 's.id = vr.student_id AND s.school_id = :sid', { sid });

    const [
      summary,
      visitsPending,
      circuitDayStatusRows,
      circuitGroupRows,
      attendanceCurrent,
      attendancePrevious,
      accessCurrent,
      accessPrevious,
      circuitCurrent,
      circuitPrevious
    ] = await Promise.all([
      this.summary(endDate, sid),
      visitsPendingQb.getCount(),
      circuitDayQb.getRawMany<{ day: string; status: CircuitStatus; cnt: string }>(),
      circuitGroupQb.getRawMany<{ groupId: string; groupName: string; grade: string; shift: string | null; cnt: string }>(),
      attendanceCurrentQb.getCount(),
      attendancePreviousQb.getCount(),
      accessCurrentQb.getCount(),
      accessPreviousQb.getCount(),
      circuitCurrentQb.getCount(),
      circuitPreviousQb.getCount()
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
    for (let i = 0; i < windowDays; i++) {
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
      window: { startDate, endDate, label: `Últimos ${windowDays} días` },
      summary,
      comparison: {
        currentWindow: { startDate, endDate, label: `Últimos ${windowDays} días` },
        previousWindow: { startDate: previousStartDate, endDate: previousEndDate, label: `Período previo (${windowDays} días)` },
        metrics: {
          attendanceRecords: toMetric(attendanceCurrent, attendancePrevious),
          accessEvents: toMetric(accessCurrent, accessPrevious),
          circuitRequests: toMetric(circuitCurrent, circuitPrevious)
        }
      },
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
