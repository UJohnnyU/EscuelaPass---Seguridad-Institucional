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
import { AuthModule } from '../auth/auth.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      AttendanceRecordEntity,
      DebtEntity,
      CircuitRequestEntity,
      AccessEventEntity,
      StudentEntity,
      TeacherEntity,
      GroupEntity,
      UserEntity
    ])
  ],
  controllers: [DashboardController],
  providers: [DashboardService]
})
export class DashboardModule {}
