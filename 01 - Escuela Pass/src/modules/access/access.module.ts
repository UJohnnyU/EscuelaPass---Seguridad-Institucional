import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessCredentialEntity } from '../../database/entities/access-credential.entity';
import { AccessEventEntity } from '../../database/entities/access-event.entity';
import { AttendanceRecordEntity } from '../../database/entities/attendance-record.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { SchoolCalendarModule } from '../school-calendar/school-calendar.module';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';

@Module({
  imports: [
    SchoolCalendarModule,
    TypeOrmModule.forFeature([
      AccessCredentialEntity,
      AccessEventEntity,
      AttendanceRecordEntity,
      StudentEntity,
      UserEntity
    ])
  ],
  controllers: [AccessController],
  providers: [AccessService]
})
export class AccessModule {}
