import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrivacyPolicyEntity } from '../../database/entities/privacy-policy.entity';
import { UserPrivacyAcceptanceEntity } from '../../database/entities/user-privacy-acceptance.entity';
import { AuditModule } from '../audit/audit.module';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PrivacyPolicyEntity, UserPrivacyAcceptanceEntity]),
    AuditModule
  ],
  controllers: [PrivacyController],
  providers: [PrivacyService]
})
export class PrivacyModule {}
