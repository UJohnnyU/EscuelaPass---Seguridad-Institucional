import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { InstitutionSettingEntity } from '../../database/entities/institution-setting.entity';
import { SchoolEntity } from '../../database/entities/school.entity';
import { UserRole } from '../../database/entities/user.entity';
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
  studentMatriculaPrefix?: string;
  maxGradeScale?: string;
  /** Ruta pública `/uploads/school-logos/…` */
  logoUrl?: string | null;
  latitude?: string | null;
  longitude?: string | null;
};

type JwtLike = { role: UserRole; schoolId?: string | null };

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(InstitutionSettingEntity)
    private readonly settingsRepository: Repository<InstitutionSettingEntity>,
    @InjectRepository(SchoolEntity)
    private readonly schoolsRepository: Repository<SchoolEntity>
  ) {}

  /** Perfil global (tabla key-value + env). Sin alcance por escuela. */
  private async getGlobalInstitutionProfile(): Promise<InstitutionProfile> {
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

  /**
   * Perfil mostrado en PDF/export: datos de la escuela si existen, con fallback al perfil global
   * para campos aún vacíos en `schools`.
   */
  async getInstitutionProfileForSchoolId(schoolId: string | null | undefined): Promise<InstitutionProfile> {
    return this.getMergedProfileForSchoolId(schoolId ?? null);
  }

  private async getMergedProfileForSchoolId(schoolId: string | null): Promise<InstitutionProfile> {
    const global = await this.getGlobalInstitutionProfile();
    if (!schoolId) return global;

    const school = await this.schoolsRepository.findOne({ where: { id: schoolId } });
    if (!school) return global;

    const pick = (local: string | null | undefined, fallback?: string) => {
      const t = local?.trim();
      return t && t.length > 0 ? t : fallback;
    };

    return {
      name: school.name.trim() || global.name,
      address: pick(school.address, global.address),
      city: pick(school.city, global.city),
      phone: pick(school.phone, global.phone),
      email: pick(school.email, global.email),
      directorName: pick(school.directorName, global.directorName),
      motto: pick(school.motto, global.motto),
      studentMatriculaPrefix: pick(school.studentMatriculaPrefix),
      maxGradeScale: school.maxGradeScale,
      logoUrl: school.logoPath ?? null,
      latitude: school.latitude ?? null,
      longitude: school.longitude ?? null
    };
  }

  private async resolveSchoolIdForGet(user: JwtLike, querySchoolId?: string): Promise<string | null> {
    if (user.role === UserRole.ADMIN) {
      const q = querySchoolId?.trim();
      if (q) {
        const row = await this.schoolsRepository.findOne({ where: { id: q }, select: ['id'] });
        if (!row) throw new NotFoundException('Escuela no encontrada');
        return q;
      }
      const first = await this.schoolsRepository.find({ order: { name: 'ASC' }, take: 1 });
      return first[0]?.id ?? null;
    }
    return user.schoolId ?? null;
  }

  /**
   * Perfil institucional para la UI: según rol y opcionalmente `schoolId` (ADMIN elige escuela).
   */
  async getInstitutionProfile(user: JwtLike, querySchoolId?: string): Promise<InstitutionProfile> {
    const sid = await this.resolveSchoolIdForGet(user, querySchoolId);
    return this.getMergedProfileForSchoolId(sid);
  }

  async setInstitutionProfile(
    user: JwtLike,
    dto: UpdateInstitutionProfileDto,
    querySchoolId?: string
  ): Promise<InstitutionProfile> {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.ADMINISTRATIVO) {
      throw new ForbiddenException('No autorizado a modificar el perfil institucional');
    }

    let targetSchoolId: string;
    if (user.role === UserRole.ADMIN) {
      const sid = querySchoolId?.trim();
      if (!sid) {
        throw new BadRequestException(
          'Indique qué escuela desea modificar (parámetro schoolId en la URL).'
        );
      }
      const school = await this.schoolsRepository.findOne({ where: { id: sid } });
      if (!school) throw new NotFoundException('Escuela no encontrada');
      targetSchoolId = sid;
    } else {
      if (!user.schoolId) {
        throw new ForbiddenException('Su cuenta no tiene escuela asignada');
      }
      targetSchoolId = user.schoolId;
    }

    const school = await this.schoolsRepository.findOne({ where: { id: targetSchoolId } });
    if (!school) throw new NotFoundException('Escuela no encontrada');

    if (dto.name !== undefined) school.name = dto.name.trim();
    if (dto.address !== undefined) school.address = dto.address.trim() ? dto.address.trim() : null;
    if (dto.city !== undefined) school.city = dto.city.trim() ? dto.city.trim() : null;
    if (dto.phone !== undefined) school.phone = dto.phone.trim() ? dto.phone.trim() : null;
    if (dto.email !== undefined) school.email = dto.email.trim() ? dto.email.trim() : null;
    if (dto.directorName !== undefined) {
      school.directorName = dto.directorName.trim() ? dto.directorName.trim() : null;
    }
    if (dto.motto !== undefined) school.motto = dto.motto.trim() ? dto.motto.trim() : null;
    if (dto.studentMatriculaPrefix !== undefined) {
      const normalized = dto.studentMatriculaPrefix
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 20);
      school.studentMatriculaPrefix = normalized.length > 0 ? normalized : null;
    }
    if (dto.maxGradeScale !== undefined) {
      school.maxGradeScale = dto.maxGradeScale.toFixed(2);
    }
    if (dto.latitude !== undefined || dto.longitude !== undefined) {
      if (user.role !== UserRole.ADMIN) {
        throw new ForbiddenException('Solo ADMIN puede modificar la ubicación institucional');
      }
      if (dto.latitude !== undefined) {
        school.latitude = dto.latitude.toFixed(8);
      }
      if (dto.longitude !== undefined) {
        school.longitude = dto.longitude.toFixed(8);
      }
    }

    await this.schoolsRepository.save(school);
    return this.getMergedProfileForSchoolId(targetSchoolId);
  }

  private async resolveSchoolIdForCircuit(user: JwtLike, querySchoolId?: string): Promise<string> {
    if (user.role === UserRole.ADMIN) {
      const sid = querySchoolId?.trim();
      if (!sid) {
        throw new BadRequestException(
          'Indique qué escuela desea consultar/modificar (parámetro schoolId en la URL).'
        );
      }
      const school = await this.schoolsRepository.findOne({ where: { id: sid }, select: ['id'] });
      if (!school) throw new NotFoundException('Escuela no encontrada');
      return sid;
    }

    if (user.role === UserRole.ADMINISTRATIVO || user.role === UserRole.DOCENTE || user.role === UserRole.PADRE || user.role === UserRole.ALUMNO) {
      const sid = user.schoolId?.trim();
      if (!sid) {
        throw new ForbiddenException('Su cuenta no tiene escuela asignada');
      }
      return sid;
    }

    throw new ForbiddenException('No autorizado');
  }

  async isCircuitEnabled(schoolId: string | null | undefined): Promise<boolean> {
    if (!schoolId) return true;
    const school = await this.schoolsRepository.findOne({
      where: { id: schoolId },
      select: ['id', 'circuitEnabled']
    });
    if (!school) return true;
    return school.circuitEnabled !== false;
  }

  async getCircuitSetting(
    user: JwtLike,
    querySchoolId?: string
  ): Promise<{ enabled: boolean; requiresEarlyPickupApproval: boolean }> {
    const schoolId = await this.resolveSchoolIdForCircuit(user, querySchoolId);
    const school = await this.schoolsRepository.findOne({
      where: { id: schoolId },
      select: ['id', 'circuitEnabled', 'circuitRequiresEarlyPickupApproval']
    });
    if (!school) throw new NotFoundException('Escuela no encontrada');
    return {
      enabled: school.circuitEnabled !== false,
      requiresEarlyPickupApproval: school.circuitRequiresEarlyPickupApproval === true
    };
  }

  async setCircuitSettings(
    user: JwtLike,
    dto: { enabled?: boolean; requiresEarlyPickupApproval?: boolean },
    querySchoolId?: string
  ): Promise<{ enabled: boolean; requiresEarlyPickupApproval: boolean }> {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.ADMINISTRATIVO) {
      throw new ForbiddenException('No autorizado para cambiar el estado del circuito');
    }

    if (dto.enabled === undefined && dto.requiresEarlyPickupApproval === undefined) {
      throw new BadRequestException('Indique al menos un valor: enabled o requiresEarlyPickupApproval.');
    }

    const schoolId = await this.resolveSchoolIdForCircuit(user, querySchoolId);
    const school = await this.schoolsRepository.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('Escuela no encontrada');
    if (dto.enabled !== undefined) {
      school.circuitEnabled = Boolean(dto.enabled);
    }
    if (dto.requiresEarlyPickupApproval !== undefined) {
      school.circuitRequiresEarlyPickupApproval = Boolean(dto.requiresEarlyPickupApproval);
    }
    await this.schoolsRepository.save(school);
    return {
      enabled: school.circuitEnabled !== false,
      requiresEarlyPickupApproval: school.circuitRequiresEarlyPickupApproval === true
    };
  }
}
