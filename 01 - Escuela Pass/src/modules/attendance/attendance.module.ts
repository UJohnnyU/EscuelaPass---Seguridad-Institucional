import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceRecordEntity } from '../../database/entities/attendance-record.entity';
import { ClassSessionEntity } from '../../database/entities/class-session.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { SchoolEntity } from '../../database/entities/school.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { SchoolCalendarModule } from '../school-calendar/school-calendar.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceShiftCloseScheduler } from './attendance-shift-close.scheduler';
import { AttendanceShiftCloseService } from './attendance-shift-close.service';
import { AttendanceService } from './attendance.service';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    SchoolCalendarModule,
    TypeOrmModule.forFeature([
      AttendanceRecordEntity,
      ClassSessionEntity,
      StudentEntity,
      TeacherEntity,
      ParentEntity,
      SchoolEntity
    ])
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceShiftCloseService, AttendanceShiftCloseScheduler]
})
export class AttendanceModule {}
