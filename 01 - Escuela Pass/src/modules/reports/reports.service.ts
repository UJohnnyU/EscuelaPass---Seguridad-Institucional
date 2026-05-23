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
import { calendarDateInTimeZone, todayInAppTimezone } from '../../common/local-date';

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
    const date = dateStr?.slice(0, 10) ?? todayInAppTimezone();
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

  async classAttendanceByGroup(groupId: string, userId: string, role: UserRole, dateStr?: string) {
    const date = dateStr?.slice(0, 10) ?? todayInAppTimezone();
    await this.assertCanViewGroup(userId, role, groupId);

    const rows = await this.attendanceRepository.manager.query<
      {
        id: string;
        studentId: string;
        classSessionId: string;
        attendanceDate: string;
        status: string;
        isJustified: boolean;
        notes: string | null;
        studentName: string;
        matricula: string;
        subjectName: string | null;
        teacherName: string | null;
        startTime: string;
        endTime: string;
      }[]
    >(
      `SELECT car.id,
              car.student_id AS "studentId",
              car.class_session_id AS "classSessionId",
              car.attendance_date AS "attendanceDate",
              car.status::text AS status,
              car.is_justified AS "isJustified",
              car.notes,
              u.full_name AS "studentName",
              s.matricula,
              sub.name AS "subjectName",
              tu.full_name AS "teacherName",
              cs.start_time AS "startTime",
              cs.end_time AS "endTime"
       FROM class_attendance_records car
       JOIN students s ON s.id = car.student_id
       JOIN users u ON u.id = s.user_id
       JOIN class_sessions cs ON cs.id = car.class_session_id
       LEFT JOIN subjects sub ON sub.id = cs.subject_id
       LEFT JOIN teachers t ON t.id = cs.teacher_id
       LEFT JOIN users tu ON tu.id = t.user_id
       WHERE s.group_id = $1
         AND car.attendance_date = $2::date
       ORDER BY cs.start_time ASC, u.full_name ASC`,
      [groupId, date]
    );

    const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {});

    return { date, groupId, totalRecords: rows.length, byStatus, data: rows };
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
    const date = dateStr?.slice(0, 10) ?? todayInAppTimezone();
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
      const day = calendarDateInTimeZone(new Date(ev.eventTime));
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

