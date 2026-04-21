import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessEventEntity } from '../../database/entities/access-event.entity';
import { AttendanceRecordEntity } from '../../database/entities/attendance-record.entity';
import { CircuitRequestEntity } from '../../database/entities/circuit-request.entity';
import { DebtEntity } from '../../database/entities/debt.entity';
import { GroupEntity } from '../../database/entities/group.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { PickupRequestEntity } from '../../database/entities/pickup-request.entity';
import { ActivitiesModule } from '../activities/activities.module';
import { AuthModule } from '../auth/auth.module';
import { MeetingsModule } from '../meetings/meetings.module';
import { NoticesModule } from '../notices/notices.module';
import { SchoolCalendarModule } from '../school-calendar/school-calendar.module';
import { DashboardController } from './dashboard.controller';
import { DashboardsController } from './dashboards.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    AuthModule,
    ActivitiesModule,
    MeetingsModule,
    NoticesModule,
    SchoolCalendarModule,
    TypeOrmModule.forFeature([
      AttendanceRecordEntity,
      DebtEntity,
      CircuitRequestEntity,
      AccessEventEntity,
      StudentEntity,
      TeacherEntity,
      GroupEntity,
      UserEntity,
      PickupRequestEntity
    ])
  ],
  controllers: [DashboardController, DashboardsController],
  providers: [DashboardService]
})
export class DashboardModule {}
