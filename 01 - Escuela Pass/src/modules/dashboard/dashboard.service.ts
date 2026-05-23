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
import { DebtAdjustmentEntity } from '../../database/entities/debt-adjustment.entity';
import { GroupEntity } from '../../database/entities/group.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
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
    @InjectRepository(DebtAdjustmentEntity)
    private readonly debtAdjustmentsRepository: Repository<DebtAdjustmentEntity>,
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

    const [
      summary,
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
      circuits: {
        byDay: circuitByDay,
        byGroup: circuitByGroup
      }
    };
  }

  async actionableKpis(dateStr?: string, schoolId?: string) {
    const date = dateStr?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    const sid = schoolId?.trim() || undefined;
    const summary = await this.summary(date, sid);

    const pendingDebts = summary.payments.pendingDebts ?? 0;
    const overdueDebts = summary.payments.overdueDebts ?? 0;
    const pendingWithVoucher = summary.payments.pendingWithVoucher ?? 0;
    const attendanceTotal = summary.attendanceToday.total ?? 0;
    const attendanceAbsent = summary.attendanceToday.byStatus?.[AttendanceStatus.AUSENTE] ?? 0;
    const circuitTotal = summary.circuitToday.total ?? 0;
    const circuitPending =
      (summary.circuitToday.byStatus?.[CircuitStatus.PENDIENTE] ?? 0) +
      (summary.circuitToday.byStatus?.[CircuitStatus.PADRE_EN_CAMINO] ?? 0);

    const adjustmentsQb = this.debtAdjustmentsRepository
      .createQueryBuilder('da')
      .where('DATE(da.created_at) = :date', { date });
    if (sid) adjustmentsQb.andWhere('da.school_id = :sid', { sid });
    const financeAdjustmentsToday = await adjustmentsQb.getCount();

    const alerts: Array<{
      key: string;
      title: string;
      metric: number;
      unit: string;
      severity: 'high' | 'medium' | 'low';
      action: string;
      owner: string;
    }> = [];

    if (overdueDebts > 0) {
      alerts.push({
        key: 'overdue_debts',
        title: 'Cartera vencida pendiente',
        metric: overdueDebts,
        unit: 'deudas',
        severity: overdueDebts >= 10 ? 'high' : 'medium',
        action: 'Ejecutar política de cartera y aplicar convenios prioritarios',
        owner: 'Finanzas / Administrativo'
      });
    }
    if (pendingWithVoucher > 0) {
      alerts.push({
        key: 'voucher_review',
        title: 'Comprobantes por verificar',
        metric: pendingWithVoucher,
        unit: 'comprobantes',
        severity: pendingWithVoucher >= 8 ? 'high' : 'medium',
        action: 'Revisar comprobantes y cerrar validación hoy',
        owner: 'Finanzas / Administrativo'
      });
    }
    if (attendanceTotal > 0 && attendanceAbsent / attendanceTotal >= 0.2) {
      alerts.push({
        key: 'attendance_absence',
        title: 'Ausentismo alto',
        metric: Number(((attendanceAbsent / attendanceTotal) * 100).toFixed(1)),
        unit: '%',
        severity: 'medium',
        action: 'Activar seguimiento de asistencia con docentes y familias',
        owner: 'Coordinación Académica'
      });
    }
    if (circuitTotal > 0 && circuitPending / circuitTotal >= 0.35) {
      alerts.push({
        key: 'circuit_pending',
        title: 'Circuitos sin cierre oportuno',
        metric: circuitPending,
        unit: 'solicitudes',
        severity: 'medium',
        action: 'Priorizar cierres de recogida y confirmaciones de entrega',
        owner: 'Control de Acceso / Administrativo'
      });
    }
    if (financeAdjustmentsToday > 0) {
      alerts.push({
        key: 'finance_adjustments',
        title: 'Ajustes financieros del día',
        metric: financeAdjustmentsToday,
        unit: 'ajustes',
        severity: financeAdjustmentsToday >= 15 ? 'medium' : 'low',
        action: 'Revisar bitácora de conciliación y justificar ajustes críticos',
        owner: 'Finanzas / Auditoría interna'
      });
    }

    return {
      date,
      schoolId: sid ?? null,
      snapshot: {
        pendingDebts,
        overdueDebts,
        pendingWithVoucher,
        attendanceTotal,
        attendanceAbsent,
        circuitTotal,
        circuitPending,
        financeAdjustmentsToday
      },
      alerts
    };
  }
}
