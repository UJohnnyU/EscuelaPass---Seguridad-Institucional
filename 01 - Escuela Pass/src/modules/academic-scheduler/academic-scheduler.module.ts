import { Module } from '@nestjs/common';
import { AcademicNotificationsModule } from '../academic-notifications/academic-notifications.module';
import { ActivitiesModule } from '../activities/activities.module';
import { ReportCardsModule } from '../report-cards/report-cards.module';
import { AcademicCloseScheduler } from './academic-close.scheduler';

@Module({
  imports: [ActivitiesModule, ReportCardsModule, AcademicNotificationsModule],
  providers: [AcademicCloseScheduler]
})
export class AcademicSchedulerModule {}
