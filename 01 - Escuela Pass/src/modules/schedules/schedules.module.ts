import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicPeriodEntity } from '../../database/entities/academic-period.entity';
import { ClassSessionEntity } from '../../database/entities/class-session.entity';
import { GroupEntity } from '../../database/entities/group.entity';
import { NotificationEntity } from '../../database/entities/notification.entity';
import { SubjectEntity } from '../../database/entities/subject.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { FcmModule } from '../fcm/fcm.module';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [
    AuthModule,
    FcmModule,
    TypeOrmModule.forFeature([
      AcademicPeriodEntity,
      ClassSessionEntity,
      GroupEntity,
      NotificationEntity,
      SubjectEntity,
      StudentEntity,
      ParentEntity,
      TeacherEntity,
      UserEntity
    ])
  ],
  controllers: [SchedulesController],
  providers: [SchedulesService],
  exports: [SchedulesService]
})
export class SchedulesModule {}
