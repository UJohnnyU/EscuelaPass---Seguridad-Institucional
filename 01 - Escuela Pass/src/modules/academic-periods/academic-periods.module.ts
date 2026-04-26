import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicPeriodEntity } from '../../database/entities/academic-period.entity';
import { SchoolEntity } from '../../database/entities/school.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { AcademicNotificationsModule } from '../academic-notifications/academic-notifications.module';
import { ActivitiesModule } from '../activities/activities.module';
import { AuthModule } from '../auth/auth.module';
import { ReportCardsModule } from '../report-cards/report-cards.module';
import { AcademicPeriodsController } from './academic-periods.controller';
import { AcademicPeriodsService } from './academic-periods.service';

@Module({
  imports: [
    AuthModule,
    AcademicNotificationsModule,
    ActivitiesModule,
    ReportCardsModule,
    TypeOrmModule.forFeature([AcademicPeriodEntity, SchoolEntity, UserEntity])
  ],
  controllers: [AcademicPeriodsController],
  providers: [AcademicPeriodsService],
  exports: [AcademicPeriodsService]
})
export class AcademicPeriodsModule {}
