import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { getAppTimeZone } from '../../common/local-date';
import { withScheduledLock } from '../../common/scheduled-lock';
import { PaymentsService } from './payments.service';

@Injectable()
export class PaymentsPoliciesScheduler {
  private readonly logger = new Logger(PaymentsPoliciesScheduler.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  /** Cada 15 min en APP_TIMEZONE: marcar deudas vencidas y recargos (sin depender de sesión). */
  @Cron('*/15 * * * *', { timeZone: getAppTimeZone() })
  async runPeriodicDebtPolicies() {
    const lockResult = await withScheduledLock('payments-policies-scheduler', async () => {
      try {
        const result = await this.paymentsService.runDebtPolicies(null);
        if (result.markedOverdue > 0 || result.lateFeeApplied > 0) {
          this.logger.log(
            `Políticas de cartera aplicadas: vencidas=${result.markedOverdue}, recargos=${result.lateFeeApplied}, revisadas=${result.checked}`
          );
        }
      } catch (err) {
        this.logger.error('Error ejecutando políticas de cartera', err as Error);
      }
    });
    if (!lockResult.executed) {
      this.logger.debug('Políticas de cartera: ejecución previa aún en curso; se omite este ciclo.');
    }
  }
}
