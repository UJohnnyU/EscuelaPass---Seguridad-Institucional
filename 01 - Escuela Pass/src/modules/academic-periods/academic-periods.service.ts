import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import {
  AcademicPeriodEntity,
  AcademicPeriodStatus
} from '../../database/entities/academic-period.entity';
import { ReportCardType } from '../../database/entities/report-card.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { AcademicNotificationsService } from '../academic-notifications/academic-notifications.service';
import { ActivitiesService } from '../activities/activities.service';
import { ReportCardsService } from '../report-cards/report-cards.service';
import { CreateAcademicPeriodDto } from './dto/create-academic-period.dto';
import { UpdateAcademicPeriodDto } from './dto/update-academic-period.dto';

export type AcademicPeriodListItem = {
  id: string;
  schoolId: string;
  schoolYear: string;
  name: string;
  orderIndex: number;
  startDate: string;
  endDate: string;
  weight: string;
  status: AcademicPeriodStatus;
  closedAt: string | null;
};

@Injectable()
export class AcademicPeriodsService {
  private readonly logger = new Logger(AcademicPeriodsService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(AcademicPeriodEntity)
    private readonly periodsRepository: Repository<AcademicPeriodEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    private readonly activitiesService: ActivitiesService,
    private readonly reportCardsService: ReportCardsService,
    private readonly notifications: AcademicNotificationsService
  ) {}

  private async resolveSchoolIdForUser(
    userId: string,
    role: UserRole,
    explicit?: string
  ): Promise<string> {
    if (explicit && role === UserRole.ADMIN) return explicit;
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new ForbiddenException('Usuario no encontrado');
    if (role === UserRole.ADMIN) {
      if (!explicit) throw new BadRequestException('schoolId es obligatorio para el administrador global');
      return explicit;
    }
    if (!user.schoolId) throw new ForbiddenException('Tu usuario no está asignado a una escuela');
    if (explicit && explicit !== user.schoolId) {
      throw new ForbiddenException('No puedes operar en una escuela distinta a la tuya');
    }
    return user.schoolId;
  }

  private rowToDto(r: AcademicPeriodEntity): AcademicPeriodListItem {
    return {
      id: r.id,
      schoolId: r.schoolId,
      schoolYear: r.schoolYear,
      name: r.name,
      orderIndex: r.orderIndex,
      startDate: r.startDate,
      endDate: r.endDate,
      weight: r.weight,
      status: r.status,
      closedAt: r.closedAt ? r.closedAt.toISOString() : null
    };
  }

  async list(
    userId: string,
    role: UserRole,
    filters: { schoolId?: string; schoolYear?: string; status?: AcademicPeriodStatus }
  ): Promise<AcademicPeriodListItem[]> {
    const schoolId = await this.resolveSchoolIdForUser(userId, role, filters.schoolId);
    const qb = this.periodsRepository
      .createQueryBuilder('p')
      .where('p.school_id = :sid', { sid: schoolId });
    if (filters.schoolYear) {
      qb.andWhere('p.school_year = :sy', { sy: filters.schoolYear });
    }
    if (filters.status) {
      qb.andWhere('p.status = :st', { st: filters.status });
    }
    qb.orderBy('p.school_year', 'DESC').addOrderBy('p.order_index', 'ASC');
    const rows = await qb.getMany();
    return rows.map((r) => this.rowToDto(r));
  }

  async listForRoleVisible(
    userId: string,
    role: UserRole,
    schoolYear?: string
  ): Promise<AcademicPeriodListItem[]> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) return [];
    if (role === UserRole.ADMIN) {
      const qb = this.periodsRepository.createQueryBuilder('p');
      if (schoolYear) qb.where('p.school_year = :sy', { sy: schoolYear });
      qb.orderBy('p.school_year', 'DESC').addOrderBy('p.order_index', 'ASC');
      return (await qb.getMany()).map((r) => this.rowToDto(r));
    }
    if (!user.schoolId) return [];
    const qb = this.periodsRepository
      .createQueryBuilder('p')
      .where('p.school_id = :sid', { sid: user.schoolId });
    if (schoolYear) qb.andWhere('p.school_year = :sy', { sy: schoolYear });
    qb.orderBy('p.school_year', 'DESC').addOrderBy('p.order_index', 'ASC');
    return (await qb.getMany()).map((r) => this.rowToDto(r));
  }

  async get(id: string, userId: string, role: UserRole): Promise<AcademicPeriodListItem> {
    const row = await this.periodsRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Periodo no encontrado');
    await this.resolveSchoolIdForUser(userId, role, row.schoolId);
    return this.rowToDto(row);
  }

  private async assertNoOverlap(
    schoolId: string,
    schoolYear: string,
    startDate: string,
    endDate: string,
    excludeId?: string
  ): Promise<void> {
    if (startDate > endDate) {
      throw new BadRequestException('La fecha de inicio no puede ser posterior a la fecha de fin');
    }
    const qb = this.periodsRepository
      .createQueryBuilder('p')
      .where('p.school_id = :sid', { sid: schoolId })
      .andWhere('p.school_year = :sy', { sy: schoolYear })
      .andWhere(':start <= p.end_date AND :end >= p.start_date', {
        start: startDate,
        end: endDate
      });
    if (excludeId) qb.andWhere('p.id <> :id', { id: excludeId });
    const count = await qb.getCount();
    if (count > 0) {
      throw new BadRequestException('Las fechas se superponen con otro periodo del mismo año');
    }
  }

  private async assertUniqueOrder(
    schoolId: string,
    schoolYear: string,
    orderIndex: number,
    excludeId?: string
  ): Promise<void> {
    const qb = this.periodsRepository
      .createQueryBuilder('p')
      .where('p.school_id = :sid', { sid: schoolId })
      .andWhere('p.school_year = :sy', { sy: schoolYear })
      .andWhere('p.order_index = :oi', { oi: orderIndex });
    if (excludeId) qb.andWhere('p.id <> :id', { id: excludeId });
    const count = await qb.getCount();
    if (count > 0) {
      throw new BadRequestException('Ya existe un periodo con ese orden para el año');
    }
  }

  private async assertWeightsDoNotExceed(
    schoolId: string,
    schoolYear: string,
    newWeight: number,
    excludeId?: string
  ): Promise<void> {
    const qb = this.periodsRepository
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.weight), 0)', 'total')
      .where('p.school_id = :sid', { sid: schoolId })
      .andWhere('p.school_year = :sy', { sy: schoolYear });
    if (excludeId) qb.andWhere('p.id <> :id', { id: excludeId });
    const { total } = (await qb.getRawOne<{ total: string }>()) ?? { total: '0' };
    const current = Number(total) || 0;
    if (current + newWeight > 100.01) {
      throw new BadRequestException(
        `La suma de pesos excede 100% (actual: ${current}%, intenta añadir ${newWeight}%).`
      );
    }
  }

  async create(
    dto: CreateAcademicPeriodDto,
    userId: string,
    role: UserRole
  ): Promise<AcademicPeriodListItem> {
    const schoolId = await this.resolveSchoolIdForUser(userId, role, dto.schoolId);
    await this.assertNoOverlap(schoolId, dto.schoolYear, dto.startDate, dto.endDate);
    await this.assertUniqueOrder(schoolId, dto.schoolYear, dto.orderIndex);
    await this.assertWeightsDoNotExceed(schoolId, dto.schoolYear, dto.weight);
    const row = this.periodsRepository.create({
      schoolId,
      schoolYear: dto.schoolYear.trim(),
      name: dto.name.trim(),
      orderIndex: dto.orderIndex,
      startDate: dto.startDate,
      endDate: dto.endDate,
      weight: dto.weight.toFixed(2),
      status: AcademicPeriodStatus.PLANNED
    });
    const saved = await this.periodsRepository.save(row);
    return this.rowToDto(saved);
  }

  async update(
    id: string,
    dto: UpdateAcademicPeriodDto,
    userId: string,
    role: UserRole
  ): Promise<AcademicPeriodListItem> {
    const row = await this.periodsRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Periodo no encontrado');
    await this.resolveSchoolIdForUser(userId, role, row.schoolId);
    if (row.status === AcademicPeriodStatus.CLOSED) {
      throw new BadRequestException('No se puede editar un periodo cerrado');
    }
    const start = dto.startDate ?? row.startDate;
    const end = dto.endDate ?? row.endDate;
    if (dto.startDate || dto.endDate) {
      await this.assertNoOverlap(row.schoolId, row.schoolYear, start, end, id);
    }
    if (dto.orderIndex !== undefined && dto.orderIndex !== row.orderIndex) {
      await this.assertUniqueOrder(row.schoolId, row.schoolYear, dto.orderIndex, id);
      row.orderIndex = dto.orderIndex;
    }
    if (dto.weight !== undefined && dto.weight.toFixed(2) !== row.weight) {
      const delta = dto.weight - Number(row.weight);
      if (delta > 0) {
        await this.assertWeightsDoNotExceed(row.schoolId, row.schoolYear, delta, id);
      }
      row.weight = dto.weight.toFixed(2);
    }
    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.startDate !== undefined) row.startDate = dto.startDate;
    if (dto.endDate !== undefined) row.endDate = dto.endDate;
    const saved = await this.periodsRepository.save(row);
    return this.rowToDto(saved);
  }

  async activate(id: string, userId: string, role: UserRole): Promise<AcademicPeriodListItem> {
    const row = await this.periodsRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Periodo no encontrado');
    await this.resolveSchoolIdForUser(userId, role, row.schoolId);
    if (row.status === AcademicPeriodStatus.CLOSED) {
      throw new BadRequestException('El periodo ya está cerrado');
    }
    row.status = AcademicPeriodStatus.ACTIVE;
    const saved = await this.periodsRepository.save(row);
    return this.rowToDto(saved);
  }

  async close(id: string, userId: string, role: UserRole): Promise<AcademicPeriodListItem> {
    const row = await this.periodsRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Periodo no encontrado');
    await this.resolveSchoolIdForUser(userId, role, row.schoolId);
    if (row.status === AcademicPeriodStatus.CLOSED) {
      return this.rowToDto(row);
    }

    let saved: AcademicPeriodEntity;
    try {
      saved = await this.dataSource.transaction(async (mgr) => {
        try {
          await this.activitiesService.closeManyByPeriod(mgr, row.id, userId);
        } catch (err) {
          this.logger.error(
            `close(${id}): fallo al cerrar actividades — ${(err as Error).message}`
          );
          throw err;
        }
        row.status = AcademicPeriodStatus.CLOSED;
        row.closedAt = new Date();
        row.closedBy = userId;
        const persisted = await mgr.getRepository(AcademicPeriodEntity).save(row);
        try {
          await this.reportCardsService.generateForPeriod(row.id, true, mgr);
        } catch (err) {
          this.logger.error(
            `close(${id}): fallo al generar boletines — ${(err as Error).message}`
          );
          throw err;
        }
        return persisted;
      });
    } catch (err) {
      this.logger.error(
        `close(${id}) aborted: ${(err as Error).message}`,
        (err as Error).stack
      );
      if (err instanceof BadRequestException || err instanceof ForbiddenException || err instanceof NotFoundException) {
        throw err;
      }
      if (err instanceof QueryFailedError) {
        throw new UnprocessableEntityException(
          `No se pudo cerrar el periodo por un error en base de datos. Si persiste, revise restricciones o datos vinculados. Detalle: ${err.message}`
        );
      }
      throw new UnprocessableEntityException(
        `No se pudo cerrar el periodo (datos o dependencias incompletas). Detalle: ${(err as Error).message}`
      );
    }

    try {
      await this.notifications.notifyReportCardsPublished(
        row.schoolId,
        row.schoolYear,
        ReportCardType.PERIOD,
        row.id
      );
    } catch {
      // no-op: fallo de notificación no revierte el cierre
    }

    try {
      const res = await this.reportCardsService.generateFinalForSchoolYear(
        row.schoolId,
        row.schoolYear,
        true
      );
      if (!res.skipped && res.generated > 0) {
        await this.notifications.notifyReportCardsPublished(
          row.schoolId,
          row.schoolYear,
          ReportCardType.FINAL,
          null
        );
      }
    } catch {
      // no-op: los finales se re-intentarán por el scheduler si falla aquí
    }

    return this.rowToDto(saved);
  }

  async delete(id: string, userId: string, role: UserRole): Promise<{ ok: true }> {
    const row = await this.periodsRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Periodo no encontrado');
    await this.resolveSchoolIdForUser(userId, role, row.schoolId);
    const usage = await this.dataSource.query<{ c: string }[]>(
      `SELECT COUNT(*)::text AS c FROM activities WHERE period_id = $1`,
      [id]
    );
    if (Number(usage[0]?.c ?? 0) > 0) {
      throw new BadRequestException('No se puede eliminar: hay actividades vinculadas al periodo');
    }
    await this.periodsRepository.delete({ id });
    return { ok: true };
  }

  async findActiveForSchool(schoolId: string): Promise<AcademicPeriodEntity | null> {
    return this.periodsRepository.findOne({
      where: { schoolId, status: AcademicPeriodStatus.ACTIVE },
      order: { orderIndex: 'ASC' }
    });
  }

  async findByIdEnsureSchool(id: string, schoolId: string): Promise<AcademicPeriodEntity> {
    const row = await this.periodsRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Periodo no encontrado');
    if (row.schoolId !== schoolId) {
      throw new ForbiddenException('El periodo no pertenece a esta escuela');
    }
    return row;
  }
}
