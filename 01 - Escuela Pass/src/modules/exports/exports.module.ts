import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceRecordEntity } from '../../database/entities/attendance-record.entity';
import { GroupEntity } from '../../database/entities/group.entity';
import { TeacherEntity } from '../../database/entities/teacher.entity';
import { AuthModule } from '../auth/auth.module';
import { SchoolCalendarModule } from '../school-calendar/school-calendar.module';
import { SettingsModule } from '../settings/settings.module';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

@Module({
  imports: [
    AuthModule,
    SchoolCalendarModule,
    SettingsModule,
    TypeOrmModule.forFeature([AttendanceRecordEntity, GroupEntity, TeacherEntity])
  ],
  controllers: [ExportsController],
  providers: [ExportsService]
})
export class ExportsModule {}
