import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParentTeacherMeetingEntity } from '../../database/entities/parent-teacher-meeting.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { AuthModule } from '../auth/auth.module';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      ParentTeacherMeetingEntity,
      StudentEntity,
      ParentEntity,
      TeacherEntity
    ])
  ],
  controllers: [MeetingsController],
  providers: [MeetingsService]
})
export class MeetingsModule {}
