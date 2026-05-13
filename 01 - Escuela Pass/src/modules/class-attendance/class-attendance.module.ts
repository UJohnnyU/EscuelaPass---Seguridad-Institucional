import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassAttendanceRecordEntity } from '../../database/entities/class-attendance-record.entity';
import { ClassSessionEntity } from '../../database/entities/class-session.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { SchoolCalendarModule } from '../school-calendar/school-calendar.module';
import { ClassAttendanceController } from './class-attendance.controller';
import { ClassAttendanceService } from './class-attendance.service';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    SchoolCalendarModule,
    TypeOrmModule.forFeature([
      ClassAttendanceRecordEntity,
      ClassSessionEntity,
      StudentEntity,
      TeacherEntity,
      ParentEntity,
      UserEntity
    ])
  ],
  controllers: [ClassAttendanceController],
  providers: [ClassAttendanceService],
  exports: [ClassAttendanceService]
})
export class ClassAttendanceModule {}
