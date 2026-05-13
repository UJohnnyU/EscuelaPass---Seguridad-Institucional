import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { AuditLogEntity } from '../../database/entities/audit-log.entity';

/**
 * Retención de la bitácora de auditoría. LFPDPPP recomienda un plazo razonable
 * y proporcional al fin de tratamiento; 24 meses cubre auditorías escolares
 * típicas (un ciclo escolar + un año fiscal completo) sin acumular PII
 * indefinidamente. Configurable vía `AUDIT_RETENTION_MONTHS`.
 *
 * Se ejecuta una vez al día a las 03:30 (hora del servidor) para minimizar
 * impacto en horarios institucionales activos.
 */
@Injectable()
export class AuditRetentionScheduler {
  private readonly logger = new Logger(AuditRetentionScheduler.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditRepository: Repository<AuditLogEntity>
  ) {}

  @Cron('30 3 * * *')
  async pruneOldEntries(): Promise<void> {
    const months = this.retentionMonths();
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    try {
      const result = await this.auditRepository.delete({
        createdAt: LessThan(cutoff)
      });
      const affected = result.affected ?? 0;
      if (affected > 0) {
        this.logger.log(
          `Auditoría: purgadas ${affected} entradas previas a ${cutoff.toISOString()} (retención ${months} meses).`
        );
      }
    } catch (err) {
      this.logger.error('No se pudo purgar audit_logs por retención', err as Error);
    }
  }

  private retentionMonths(): number {
    const raw = Number.parseInt(process.env.AUDIT_RETENTION_MONTHS ?? '24', 10);
    if (Number.isFinite(raw) && raw >= 1 && raw <= 240) return raw;
    return 24;
  }
}
