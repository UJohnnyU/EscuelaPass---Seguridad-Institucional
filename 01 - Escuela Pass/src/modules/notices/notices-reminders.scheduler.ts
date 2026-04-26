import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NoticesService } from './notices.service';

@Injectable()
export class NoticesRemindersScheduler {
  private readonly logger = new Logger(NoticesRemindersScheduler.name);

  constructor(private readonly noticesService: NoticesService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async runCriticalReadReminders() {
    try {
      const result = await this.noticesService.sendCriticalReadReminders({
        minHoursSinceNotice: 6,
        maxNotices: 40
      });
      if (result.remindersCreated > 0) {
        this.logger.log(
          `Recordatorios críticos enviados: ${result.remindersCreated} (avisos revisados: ${result.noticesChecked})`
        );
      }
    } catch (err) {
      this.logger.error('Error enviando recordatorios de lectura crítica', err as Error);
    }
  }
}
