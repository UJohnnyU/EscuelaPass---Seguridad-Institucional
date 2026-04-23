import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, LessThan } from 'typeorm';
import { todayLocalISODate } from '../../common/local-date';
import {
  AcademicPeriodEntity,
  AcademicPeriodStatus
} from '../../database/entities/academic-period.entity';
import { ReportCardType } from '../../database/entities/report-card.entity';
import { AcademicNotificationsService } from '../academic-notifications/academic-notifications.service';
import { AcademicPeriodsService } from '../academic-periods/academic-periods.service';
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
 *  4. Cierra periodos que fueron reabiertos y siguen ACTIVOS pasado el 1 de enero del año
 *     siguiente al de la reapertura (si no se cerraron a mano antes).
 */
@Injectable()
export class AcademicCloseScheduler {
  private readonly logger = new Logger(AcademicCloseScheduler.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly activitiesService: ActivitiesService,
    private readonly reportCardsService: ReportCardsService,
    private readonly notifications: AcademicNotificationsService,
    private readonly academicPeriodsService: AcademicPeriodsService
  ) {}

  /** 03:00 hora del servidor — evita solaparse con otros jobs nocturnos. */
  @Cron('0 3 * * *')
  async runDailyCycle(): Promise<void> {
    const lock = await this.dataSource.query<{ acquired: boolean }[]>(
      `SELECT pg_try_advisory_lock(847291103, 129384756) AS acquired`
    );
    if (!lock[0]?.acquired) {
      this.logger.warn('Ciclo académico: bloqueo activo en otra instancia; omisión segura.');
      return;
    }
    this.logger.log('Ciclo académico diario: iniciando');
    try {
      await this.activatePlannedPeriods();
      await this.closeExpiredPeriods();
      const autoReclosed = await this.academicPeriodsService.runAutoCloseReopenedPastDeadline();
      if (autoReclosed > 0) {
        this.logger.log(`Periodos reabiertos cerrados automáticamente (plazo 1 ene): ${autoReclosed}`);
      }
      await this.tryGenerateFinalReportCards();
      this.logger.log('Ciclo académico diario: finalizado');
    } catch (err) {
      this.logger.error('Error en el ciclo académico diario', err as Error);
    } finally {
      await this.dataSource.query(`SELECT pg_advisory_unlock(847291103, 129384756)`);
    }
  }

  private async activatePlannedPeriods(): Promise<void> {
    const periods = await this.dataSource.getRepository(AcademicPeriodEntity).find({
      where: { status: AcademicPeriodStatus.PLANNED }
    });
    const todayISO = todayLocalISODate();
    for (const p of periods) {
      if (p.startDate <= todayISO && p.endDate >= todayISO) {
        p.status = AcademicPeriodStatus.ACTIVE;
        await this.dataSource.getRepository(AcademicPeriodEntity).save(p);
        this.logger.log(`Periodo activado: ${p.schoolYear} ${p.name} (${p.schoolId})`);
      }
    }
  }

  /**
   * Cierra periodos cuya fecha de fin ya pasó: ACTIVE o PLANNED que quedaron sin activar
   * a tiempo (p. ej. sin clases en el rango del cron anterior).
   */
  private async closeExpiredPeriods(): Promise<void> {
    const todayISO = todayLocalISODate();
    const periods = await this.dataSource.getRepository(AcademicPeriodEntity).find({
      where: {
        status: In([AcademicPeriodStatus.ACTIVE, AcademicPeriodStatus.PLANNED]),
        endDate: LessThan(todayISO)
      }
    });
    for (const p of periods) {
      await this.dataSource.transaction(async (mgr) => {
        const res = await this.activitiesService.closeManyByPeriod(mgr, p.id, null);
        this.logger.log(
          `Periodo ${p.schoolYear} ${p.name}: cerradas ${res.closed} actividades abiertas`
        );
        p.status = AcademicPeriodStatus.CLOSED;
        p.closedAt = new Date();
        p.closedBy = null;
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
