import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InstitutionSettingEntity } from '../../database/entities/institution-setting.entity';

export const CIRCUIT_ENABLED_KEY = 'circuit.enabled';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(InstitutionSettingEntity)
    private readonly settingsRepository: Repository<InstitutionSettingEntity>
  ) {}

  async isCircuitEnabled(): Promise<boolean> {
    const row = await this.settingsRepository.findOne({ where: { settingKey: CIRCUIT_ENABLED_KEY } });
    if (!row) return true;
    return row.value === 'true';
  }

  async getCircuitSetting(): Promise<{ enabled: boolean }> {
    const enabled = await this.isCircuitEnabled();
    return { enabled };
  }

  async setCircuitEnabled(enabled: boolean): Promise<{ enabled: boolean }> {
    const value = enabled ? 'true' : 'false';
    await this.settingsRepository.save(
      this.settingsRepository.create({
        settingKey: CIRCUIT_ENABLED_KEY,
        value
      })
    );
    return { enabled };
  }
}
