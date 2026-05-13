import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstitutionSettingEntity } from '../../database/entities/institution-setting.entity';
import { SchoolEntity } from '../../database/entities/school.entity';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { FcmModule } from '../fcm/fcm.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [AuthModule, AuditModule, FcmModule, TypeOrmModule.forFeature([InstitutionSettingEntity, SchoolEntity])],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService]
})
export class SettingsModule {}
