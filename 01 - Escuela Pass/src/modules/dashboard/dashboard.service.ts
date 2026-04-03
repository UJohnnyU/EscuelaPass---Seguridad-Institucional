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
import { SchoolCalendarService } from '../school-calendar/school-calendar.service';

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
}
