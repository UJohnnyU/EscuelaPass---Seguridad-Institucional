import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationEntity } from '../../database/entities/notification.entity';
import { ReportCardEntity } from '../../database/entities/report-card.entity';
import { FcmModule } from '../fcm/fcm.module';
import { AcademicNotificationsService } from './academic-notifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationEntity, ReportCardEntity]), FcmModule],
  providers: [AcademicNotificationsService],
  exports: [AcademicNotificationsService]
})
export class AcademicNotificationsModule {}
