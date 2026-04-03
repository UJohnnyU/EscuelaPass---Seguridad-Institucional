import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupEntity } from '../../database/entities/group.entity';
import { SchoolNonInstructionalDayEntity } from '../../database/entities/school-non-instructional-day.entity';
import { AuthModule } from '../auth/auth.module';
import { SchoolCalendarController } from './school-calendar.controller';
import { SchoolCalendarService } from './school-calendar.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([SchoolNonInstructionalDayEntity, GroupEntity])
  ],
  controllers: [SchoolCalendarController],
  providers: [SchoolCalendarService],
  exports: [SchoolCalendarService]
})
export class SchoolCalendarModule {}
