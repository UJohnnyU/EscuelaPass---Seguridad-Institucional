import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupEntity } from '../../database/entities/group.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { ReportCardsModule } from '../report-cards/report-cards.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { SettingsModule } from '../settings/settings.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [
    ReportCardsModule,
    SchedulesModule,
    SettingsModule,
    TypeOrmModule.forFeature([GroupEntity, StudentEntity, UserEntity])
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService]
})
export class DocumentsModule {}
