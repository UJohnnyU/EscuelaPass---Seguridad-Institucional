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
import { todayLocalISODate } from '../../common/local-date';
import {
  AcademicPeriodEntity,
  AcademicPeriodStatus
} from '../../database/entities/academic-period.entity';
import { ReportCardType } from '../../database/entities/report-card.entity';
import { SchoolEntity } from '../../database/entities/school.entity';
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
  reopenedAt: string | null;
};

export type AcademicPolicyEffective = {
  schoolId: string;
  schoolYear: string;
  maxGradeScale: string;
  passingGrade: string;
  minFailedSubjectsToRepeat: number;
  periods: Array<{
    id: string;
    name: string;
    orderIndex: number;
    status: AcademicPeriodStatus;
    weight: string;
    startDate: string;
    endDate: string;
  }>;
  totalWeight: string;
  remainingWeight: string;
};

@Injectable()
export class AcademicPeriodsService {
  private readonly logger = new Logger(AcademicPeriodsService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(AcademicPeriodEntity)
    private readonly periodsRepository: Repository<AcademicPeriodEntity>,
    @InjectRepository(SchoolEntity)
    private readonly schoolsRepository: Repository<SchoolEntity>,
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
      closedAt: r.closedAt ? r.closedAt.toISOString() : null,
      reopenedAt: r.reopenedAt ? r.reopenedAt.toISOString() : null
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

  async getEffectivePolicy(
    userId: string,
    role: UserRole,
    filters: { schoolId?: string; schoolYear?: string }
  ): Promise<AcademicPolicyEffective> {
    const schoolId = await this.resolveSchoolIdForUser(userId, role, filters.schoolId);
    const school = await this.schoolsRepository.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('Escuela no encontrada');

    const qb = this.periodsRepository
      .createQueryBuilder('p')
      .where('p.school_id = :sid', { sid: schoolId });
    if (filters.schoolYear?.trim()) {
      qb.andWhere('p.school_year = :sy', { sy: filters.schoolYear.trim() });
    } else {
      // Año preferido: ACTIVO > PLANEADO > más reciente.
      qb.orderBy(
        `CASE
           WHEN p.status = '${AcademicPeriodStatus.ACTIVE}' THEN 0
           WHEN p.status = '${AcademicPeriodStatus.PLANNED}' THEN 1
           ELSE 2
         END`,
        'ASC'
      ).addOrderBy('p.school_year', 'DESC').addOrderBy('p.order_index', 'ASC');
      const hinted = await qb.getMany();
      const targetYear = hinted[0]?.schoolYear;
      if (!targetYear) {
        return {
          schoolId,
          schoolYear: filters.schoolYear?.trim() || new Date().getFullYear().toString(),
          maxGradeScale: school.maxGradeScale ?? '100.00',
          passingGrade: school.passingGrade ?? '0.00',
          minFailedSubjectsToRepeat: school.minFailedSubjectsToRepeat ?? 3,
          periods: [],
          totalWeight: '0.00',
          remainingWeight: '100.00'
        };
      }
      return this.getEffectivePolicy(userId, role, { schoolId, schoolYear: targetYear });
    }

    qb.orderBy('p.order_index', 'ASC');
    const periods = await qb.getMany();
    const totalWeight = periods.reduce((acc, p) => acc + (Number(p.weight) || 0), 0);
    const remaining = Math.max(0, 100 - totalWeight);

    return {
      schoolId,
      schoolYear: filters.schoolYear?.trim() || '',
      maxGradeScale: school.maxGradeScale ?? '100.00',
      passingGrade: school.passingGrade ?? '0.00',
      minFailedSubjectsToRepeat: school.minFailedSubjectsToRepeat ?? 3,
      periods: periods.map((p) => ({
        id: p.id,
        name: p.name,
        orderIndex: p.orderIndex,
        status: p.status,
        weight: p.weight,
        startDate: p.startDate,
        endDate: p.endDate
      })),
      totalWeight: totalWeight.toFixed(2),
      remainingWeight: remaining.toFixed(2)
    };
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
      throw new BadRequestException(
        'El periodo está cerrado. Use «Reabrir» si aplica (mismo año calendario del cierre).'
      );
    }
    row.status = AcademicPeriodStatus.ACTIVE;
    const saved = await this.periodsRepository.save(row);
    return this.rowToDto(saved);
  }

  /**
   * Vuelve a ACTIVO un periodo CERRADO solo si el cierre fue en el año calendario en curso (zona del servidor).
   * Marca `reopenedAt`: si no se cierra de nuevo a mano antes del 1 de enero del año siguiente, el cron lo cerrará.
   */
  async reopen(id: string, userId: string, role: UserRole): Promise<AcademicPeriodListItem> {
    const row = await this.periodsRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Periodo no encontrado');
    await this.resolveSchoolIdForUser(userId, role, row.schoolId);
    if (row.status !== AcademicPeriodStatus.CLOSED) {
      throw new BadRequestException('Solo se pueden reabrir periodos cerrados');
    }
    if (!row.closedAt) {
      throw new BadRequestException('El periodo no tiene fecha de cierre registrada; no se puede reabrir.');
    }
    const closedAt = row.closedAt instanceof Date ? row.closedAt : new Date(row.closedAt);
    const now = new Date();
    if (closedAt.getFullYear() !== now.getFullYear()) {
      throw new BadRequestException(
        'Solo puede reabrir periodos cerrados en el año calendario actual (el año en que se cerraron).'
      );
    }
    row.status = AcademicPeriodStatus.ACTIVE;
    row.closedAt = null;
    row.closedBy = null;
    row.reopenedAt = new Date();
    const saved = await this.periodsRepository.save(row);
    return this.rowToDto(saved);
  }

  private async executeCloseTransaction(
    row: AcademicPeriodEntity,
    closedByUserId: string | null
  ): Promise<AcademicPeriodEntity> {
    return this.dataSource.transaction(async (mgr) => {
      try {
        await this.activitiesService.closeManyByPeriod(mgr, row.id, closedByUserId);
      } catch (err) {
        this.logger.error(
          `close(${row.id}): fallo al cerrar actividades — ${(err as Error).message}`
        );
        throw err;
      }
      row.status = AcademicPeriodStatus.CLOSED;
      row.closedAt = new Date();
      row.closedBy = closedByUserId;
      row.reopenedAt = null;
      const persisted = await mgr.getRepository(AcademicPeriodEntity).save(row);
      try {
        await this.reportCardsService.generateForPeriod(row.id, true, mgr);
      } catch (err) {
        this.logger.error(`close(${row.id}): fallo al generar boletines — ${(err as Error).message}`);
        throw err;
      }
      return persisted;
    });
  }

  private async publishAfterPeriodClose(row: AcademicPeriodEntity): Promise<void> {
    try {
      await this.notifications.notifyReportCardsPublished(
        row.schoolId,
        row.schoolYear,
        ReportCardType.PERIOD,
        row.id
      );
    } catch {
      // no-op
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
      // no-op
    }
  }

  /**
   * Periodos reabiertos (reopened_at) que sigan ACTIVOS pasado el 1 de ene del año siguiente al de la reapertura.
   * Invocado solo desde el cron académico.
   */
  async runAutoCloseReopenedPastDeadline(): Promise<number> {
    const today = todayLocalISODate();
    const candidates = await this.periodsRepository.find({
      where: { status: AcademicPeriodStatus.ACTIVE }
    });
    let n = 0;
    for (const candidate of candidates) {
      if (!candidate.reopenedAt) continue;
      const re = candidate.reopenedAt instanceof Date ? candidate.reopenedAt : new Date(candidate.reopenedAt);
      const deadline = `${re.getFullYear() + 1}-01-01`;
      if (today < deadline) continue;
      const row = await this.periodsRepository.findOne({ where: { id: candidate.id } });
      if (!row || row.status !== AcademicPeriodStatus.ACTIVE || !row.reopenedAt) continue;
      try {
        const saved = await this.executeCloseTransaction(row, null);
        await this.publishAfterPeriodClose(saved);
        n += 1;
        this.logger.log(
          `Auto-cierre periodo reabierto (plazo 1 ene): ${saved.schoolYear} ${saved.name} (${saved.id})`
        );
      } catch (err) {
        this.logger.warn(
          `No se pudo auto-cerrar periodo reabierto ${candidate.id}: ${(err as Error).message}`
        );
      }
    }
    return n;
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
      saved = await this.executeCloseTransaction(row, userId);
    } catch (err) {
      this.logger.error(`close(${id}) aborted: ${(err as Error).message}`, (err as Error).stack);
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

    await this.publishAfterPeriodClose(saved);

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
