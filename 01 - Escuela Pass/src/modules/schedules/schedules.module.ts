import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassScheduleSlotEntity } from '../../database/entities/class-schedule-slot.entity';
import { GroupEntity } from '../../database/entities/group.entity';
import { SubjectEntity } from '../../database/entities/subject.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      ClassScheduleSlotEntity,
      GroupEntity,
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
