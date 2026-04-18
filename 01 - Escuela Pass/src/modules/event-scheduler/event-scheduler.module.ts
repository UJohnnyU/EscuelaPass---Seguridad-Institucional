import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExternalVisitEntity } from '../../database/entities/external-visit.entity';
import { ExternalVisitGroupEntity } from '../../database/entities/external-visit-group.entity';
import { ExternalVisitStudentEntity } from '../../database/entities/external-visit-student.entity';
import { MeetingEntity } from '../../database/entities/meeting.entity';
import { MeetingParticipantEntity } from '../../database/entities/meeting-participant.entity';
import { EventsCoreModule } from '../events-core/events-core.module';
import { EventRemindersScheduler } from './event-reminders.scheduler';

@Module({
  imports: [
    EventsCoreModule,
    TypeOrmModule.forFeature([
      ExternalVisitEntity,
      ExternalVisitGroupEntity,
      ExternalVisitStudentEntity,
      MeetingEntity,
      MeetingParticipantEntity
    ])
  ],
  providers: [EventRemindersScheduler]
})
export class EventSchedulerModule {}
