import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { InstitutionSettingEntity } from '../../database/entities/institution-setting.entity';
import { UpdateInstitutionProfileDto } from './dto/update-institution-profile.dto';

export const CIRCUIT_ENABLED_KEY = 'circuit.enabled';

export const INSTITUTION_SETTING_KEYS = {
  name: 'institution.name',
  address: 'institution.address',
  city: 'institution.city',
  phone: 'institution.phone',
  email: 'institution.email',
  directorName: 'institution.director_name',
  motto: 'institution.motto'
} as const;

export type InstitutionProfile = {
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  directorName?: string;
  motto?: string;
};

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(InstitutionSettingEntity)
    private readonly settingsRepository: Repository<InstitutionSettingEntity>
  ) {}

  async getInstitutionProfile(): Promise<InstitutionProfile> {
    const keys = Object.values(INSTITUTION_SETTING_KEYS);
    const rows = await this.settingsRepository.find({
      where: { settingKey: In(keys) }
    });
    const map = new Map(rows.map((r) => [r.settingKey, r.value.trim()]));
    const pick = (k: string) => {
      const v = map.get(k);
      return v && v.length > 0 ? v : undefined;
    };
    return {
      name:
        pick(INSTITUTION_SETTING_KEYS.name) ??
        process.env.INSTITUTION_NAME?.trim() ??
        'Institución educativa',
      address: pick(INSTITUTION_SETTING_KEYS.address) ?? process.env.INSTITUTION_ADDRESS?.trim(),
      city: pick(INSTITUTION_SETTING_KEYS.city) ?? process.env.INSTITUTION_CITY?.trim(),
      phone: pick(INSTITUTION_SETTING_KEYS.phone) ?? process.env.INSTITUTION_PHONE?.trim(),
      email: pick(INSTITUTION_SETTING_KEYS.email) ?? process.env.INSTITUTION_EMAIL?.trim(),
      directorName: pick(INSTITUTION_SETTING_KEYS.directorName),
      motto: pick(INSTITUTION_SETTING_KEYS.motto)
    };
  }

  async setInstitutionProfile(dto: UpdateInstitutionProfileDto): Promise<InstitutionProfile> {
    const entries: Array<{ key: string; value: string }> = [];
    if (dto.name !== undefined) entries.push({ key: INSTITUTION_SETTING_KEYS.name, value: dto.name });
    if (dto.address !== undefined) entries.push({ key: INSTITUTION_SETTING_KEYS.address, value: dto.address });
    if (dto.city !== undefined) entries.push({ key: INSTITUTION_SETTING_KEYS.city, value: dto.city });
    if (dto.phone !== undefined) entries.push({ key: INSTITUTION_SETTING_KEYS.phone, value: dto.phone });
    if (dto.email !== undefined) entries.push({ key: INSTITUTION_SETTING_KEYS.email, value: dto.email });
    if (dto.directorName !== undefined) {
      entries.push({ key: INSTITUTION_SETTING_KEYS.directorName, value: dto.directorName });
    }
    if (dto.motto !== undefined) entries.push({ key: INSTITUTION_SETTING_KEYS.motto, value: dto.motto });

    for (const { key, value } of entries) {
      await this.settingsRepository.save(
        this.settingsRepository.create({ settingKey: key, value })
      );
    }
    return this.getInstitutionProfile();
  }

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
