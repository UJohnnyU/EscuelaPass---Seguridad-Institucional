import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { getAppTimeZone } from '../../common/local-date';
import { AttendanceShiftCloseService } from './attendance-shift-close.service';

@Injectable()
export class AttendanceShiftCloseScheduler {
  private readonly logger = new Logger(AttendanceShiftCloseScheduler.name);

  constructor(private readonly shiftClose: AttendanceShiftCloseService) {}

  /** Cada 15 min en APP_TIMEZONE: ausencias automáticas al cierre de jornada configurada. */
  @Cron('*/15 * * * *', { timeZone: getAppTimeZone() })
  async tick(): Promise<void> {
    try {
      await this.shiftClose.runShiftClosures();
    } catch (e) {
      this.logger.error(e instanceof Error ? e.stack ?? e.message : e);
    }
  }
}
