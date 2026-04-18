import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationEntity } from '../../database/entities/notification.entity';
import { FcmModule } from '../fcm/fcm.module';
import { AudienceResolverService } from './audience-resolver.service';
import { EventNotificationsService } from './event-notifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationEntity]), FcmModule],
  providers: [AudienceResolverService, EventNotificationsService],
  exports: [AudienceResolverService, EventNotificationsService]
})
export class EventsCoreModule {}
