import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeetingEntity } from '../../database/entities/meeting.entity';
import { MeetingParticipantEntity } from '../../database/entities/meeting-participant.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { EventsCoreModule } from '../events-core/events-core.module';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';

@Module({
  imports: [
    AuthModule,
    EventsCoreModule,
    TypeOrmModule.forFeature([
      MeetingEntity,
      MeetingParticipantEntity,
      UserEntity,
      TeacherEntity
    ])
  ],
  controllers: [MeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService]
})
export class MeetingsModule {}
