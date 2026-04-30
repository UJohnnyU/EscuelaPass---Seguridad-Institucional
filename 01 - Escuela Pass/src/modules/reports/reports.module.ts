import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessEventEntity } from '../../database/entities/access-event.entity';
import { AttendanceRecordEntity } from '../../database/entities/attendance-record.entity';
import { CircuitRequestEntity } from '../../database/entities/circuit-request.entity';
import { DebtEntity } from '../../database/entities/debt.entity';
import { ParentEntity } from '../../database/entities/parent.entity';
import { PaymentRecordEntity } from '../../database/entities/payment-record.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { AuthModule } from '../auth/auth.module';
import { SchoolCalendarModule } from '../school-calendar/school-calendar.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    AuthModule,
    SchoolCalendarModule,
    TypeOrmModule.forFeature([
      AccessEventEntity,
      AttendanceRecordEntity,
      StudentEntity,
      TeacherEntity,
      ParentEntity,
      DebtEntity,
      PaymentRecordEntity,
      CircuitRequestEntity
    ])
  ],
  controllers: [ReportsController],
  providers: [ReportsService]
})
export class ReportsModule {}

