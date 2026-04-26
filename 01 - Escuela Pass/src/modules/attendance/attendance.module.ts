import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceRecordEntity } from '../../database/entities/attendance-record.entity';
import { ClassSessionEntity } from '../../database/entities/class-session.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { AuthModule } from '../auth/auth.module';
import { SchoolCalendarModule } from '../school-calendar/school-calendar.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

@Module({
  imports: [
    AuthModule,
    SchoolCalendarModule,
    TypeOrmModule.forFeature([
      AttendanceRecordEntity,
      ClassSessionEntity,
      StudentEntity,
      TeacherEntity,
      ParentEntity
    ])
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService]
})
export class AttendanceModule {}
