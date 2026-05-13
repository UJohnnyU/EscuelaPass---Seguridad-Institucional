import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogEntity } from '../../database/entities/audit-log.entity';
import { AuditController } from './audit.controller';
import { AuditRetentionScheduler } from './audit-retention.scheduler';
import { AuditService } from './audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity])],
  controllers: [AuditController],
  providers: [AuditService, AuditRetentionScheduler],
  exports: [AuditService]
})
export class AuditModule {}
