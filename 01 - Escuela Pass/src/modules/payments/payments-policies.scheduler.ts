import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PaymentsService } from './payments.service';

@Injectable()
export class PaymentsPoliciesScheduler {
  private readonly logger = new Logger(PaymentsPoliciesScheduler.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Cron('0 3 * * *')
  async runNightlyPolicies() {
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
  }
}
