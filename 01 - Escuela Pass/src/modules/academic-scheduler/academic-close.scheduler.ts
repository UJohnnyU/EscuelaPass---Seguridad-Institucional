import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  AcademicPeriodEntity,
  AcademicPeriodStatus
} from '../../database/entities/academic-period.entity';
import { ReportCardType } from '../../database/entities/report-card.entity';
import { AcademicNotificationsService } from '../academic-notifications/academic-notifications.service';
import { ActivitiesService } from '../activities/activities.service';
import { ReportCardsService } from '../report-cards/report-cards.service';

/**
 * Corre una vez al día y aplica el ciclo académico:
 *  1. Activa periodos PLANNED cuya fecha de inicio ya llegó.
 *  2. Cierra periodos ACTIVE cuya fecha de fin ya pasó: cierra actividades
 *     abiertas del periodo (completando con 0 a quien no tenga nota),
 *     genera y publica los boletines de periodo.
 *  3. Si todos los periodos del año escolar de una escuela están cerrados,
 *     genera y publica el boletín final con el estado de promoción.
 */
@Injectable()
export class AcademicCloseScheduler {
  private readonly logger = new Logger(AcademicCloseScheduler.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly activitiesService: ActivitiesService,
    private readonly reportCardsService: ReportCardsService,
    private readonly notifications: AcademicNotificationsService
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async runDailyCycle(): Promise<void> {
    this.logger.log('Ciclo académico diario: iniciando');
    try {
      await this.activatePlannedPeriods();
      await this.closeExpiredPeriods();
      await this.tryGenerateFinalReportCards();
      this.logger.log('Ciclo académico diario: finalizado');
    } catch (err) {
      this.logger.error('Error en el ciclo académico diario', err as Error);
    }
  }

  private async activatePlannedPeriods(): Promise<void> {
    const periods = await this.dataSource.getRepository(AcademicPeriodEntity).find({
      where: { status: AcademicPeriodStatus.PLANNED }
    });
    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    for (const p of periods) {
      if (p.startDate <= todayISO && p.endDate >= todayISO) {
        p.status = AcademicPeriodStatus.ACTIVE;
        await this.dataSource.getRepository(AcademicPeriodEntity).save(p);
        this.logger.log(`Periodo activado: ${p.schoolYear} ${p.name} (${p.schoolId})`);
      }
    }
  }

  private async closeExpiredPeriods(): Promise<void> {
    const periods = await this.dataSource.getRepository(AcademicPeriodEntity).find({
      where: { status: AcademicPeriodStatus.ACTIVE }
    });
    const todayISO = new Date().toISOString().slice(0, 10);
    for (const p of periods) {
      if (p.endDate >= todayISO) continue;

      await this.dataSource.transaction(async (mgr) => {
        const res = await this.activitiesService.closeManyByPeriod(mgr, p.id, null);
        this.logger.log(
          `Periodo ${p.schoolYear} ${p.name}: cerradas ${res.closed} actividades abiertas`
        );
        p.status = AcademicPeriodStatus.CLOSED;
        p.closedAt = new Date();
        await mgr.getRepository(AcademicPeriodEntity).save(p);
        await this.reportCardsService.generateForPeriod(p.id, true, mgr);
      });

      try {
        await this.notifications.notifyReportCardsPublished(
          p.schoolId,
          p.schoolYear,
          ReportCardType.PERIOD,
          p.id
        );
      } catch (err) {
        this.logger.warn(`No se pudieron enviar notificaciones de periodo: ${String(err)}`);
      }
    }
  }

  private async tryGenerateFinalReportCards(): Promise<void> {
    const combos = await this.dataSource.query<
      { school_id: string; school_year: string }[]
    >(
      `SELECT school_id, school_year
       FROM academic_periods
       GROUP BY school_id, school_year
       HAVING COUNT(*) > 0 AND BOOL_AND(status = 'CLOSED')`
    );
    for (const c of combos) {
      try {
        const res = await this.reportCardsService.generateFinalForSchoolYear(
          c.school_id,
          c.school_year,
          true
        );
        if (!res.skipped && res.generated > 0) {
          await this.notifications.notifyReportCardsPublished(
            c.school_id,
            c.school_year,
            ReportCardType.FINAL,
            null
          );
        }
      } catch (err) {
        this.logger.warn(
          `No se pudo generar boletín final ${c.school_year} (${c.school_id}): ${String(err)}`
        );
      }
    }
  }
}
