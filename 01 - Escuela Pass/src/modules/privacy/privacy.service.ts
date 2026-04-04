import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrivacyPolicyEntity } from '../../database/entities/privacy-policy.entity';
import { UserPrivacyAcceptanceEntity } from '../../database/entities/user-privacy-acceptance.entity';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PrivacyService {
  constructor(
    @InjectRepository(PrivacyPolicyEntity)
    private readonly policiesRepository: Repository<PrivacyPolicyEntity>,
    @InjectRepository(UserPrivacyAcceptanceEntity)
    private readonly acceptancesRepository: Repository<UserPrivacyAcceptanceEntity>,
    private readonly auditService: AuditService
  ) {}

  async getLatestPolicy() {
    const row = await this.policiesRepository.findOne({
      order: { effectiveAt: 'DESC', createdAt: 'DESC' }
    });
    if (!row) throw new NotFoundException('No hay política publicada');
    return row;
  }

  async listMyAcceptances(userId: string) {
    return this.acceptancesRepository.find({
      where: { userId },
      order: { acceptedAt: 'DESC' }
    });
  }

  async accept(userId: string, version: string, ip?: string | null) {
    const pol = await this.policiesRepository.findOne({ where: { version } });
    if (!pol) throw new NotFoundException('Versión de política no encontrada');

    const existing = await this.acceptancesRepository.findOne({
      where: { userId, policyVersion: version }
    });
    if (existing) {
      return { message: 'Esta versión ya estaba aceptada', version };
    }

    const row = this.acceptancesRepository.create({
      userId,
      policyVersion: version,
      ipAddress: ip ?? null
    });
    await this.acceptancesRepository.save(row);
    await this.auditService.log(
      userId,
      'privacy.policy.accepted',
      'privacy_policy',
      null,
      { version },
      ip ?? null
    );
    return { message: 'Aceptación registrada', version };
  }
}
