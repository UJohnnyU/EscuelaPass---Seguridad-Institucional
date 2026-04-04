import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../../database/entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditRepository: Repository<AuditLogEntity>
  ) {}

  async log(
    userId: string | null,
    action: string,
    entityType?: string | null,
    entityId?: string | null,
    metadata?: Record<string, unknown> | null,
    ip?: string | null
  ) {
    const row = this.auditRepository.create({
      userId,
      action,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      metadata: metadata ?? null,
      ipAddress: ip ?? null
    });
    await this.auditRepository.save(row);
  }

  async listRecent(limit = 50) {
    const safe = Math.max(1, Math.min(200, limit));
    return this.auditRepository.find({
      order: { createdAt: 'DESC' },
      take: safe
    });
  }
}
