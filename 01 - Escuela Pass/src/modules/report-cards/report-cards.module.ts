import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicPeriodEntity } from '../../database/entities/academic-period.entity';
import { ReportCardEntity } from '../../database/entities/report-card.entity';
import { ReportCardSubjectEntity } from '../../database/entities/report-card-subject.entity';
import { SchoolEntity } from '../../database/entities/school.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { ReportCardsController } from './report-cards.controller';
import { ReportCardsService } from './report-cards.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      ReportCardEntity,
      ReportCardSubjectEntity,
      AcademicPeriodEntity,
      SchoolEntity,
      UserEntity
    ])
  ],
  controllers: [ReportCardsController],
  providers: [ReportCardsService],
  exports: [ReportCardsService]
})
export class ReportCardsModule {}
