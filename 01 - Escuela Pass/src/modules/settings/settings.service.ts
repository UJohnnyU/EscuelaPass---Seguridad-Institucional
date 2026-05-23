/*
Escuela Pass — Proprietary Software License
Copyright (c) 2026 Murillo Martínez Jhon Kevin. All Rights Reserved.

NOTICE: This software and associated documentation files (the "Software")
constitute proprietary intellectual property. Unauthorized use is prohibited.

1. GRANT OF RIGHTS
   No license is granted to any person or entity except as expressly set
   forth in a separate written agreement signed by the copyright holder.

2. RESTRICTIONS
   Without prior written permission from the copyright holder, you may NOT:
   (a) copy, modify, adapt, translate, or create derivative works of the Software;
   (b) reverse engineer, decompile, or disassemble the Software, except as
       permitted by applicable law;
   (c) distribute, sublicense, lease, rent, sell, or otherwise transfer the
       Software or any portion thereof;
   (d) use the Software for commercial purposes, including offering it as a
       hosted service to third parties;
   (e) remove or alter any proprietary notices, labels, or marks.

3. THIRD-PARTY COMPONENTS
   The Software may include or depend on third-party open-source components
   licensed under their own terms (see package manifests and NOTICE files).
   Those components remain governed by their respective licenses. This license
   applies only to the original work of the copyright holder.

4. ACADEMIC REPOSITORY (POLI JIC)
   A non-exclusive, royalty-free, limited license is granted to Politécnico
   Colombiano Jaime Isaza Cadavid solely to archive, reproduce, and make
   available the version of the Software submitted as part of the author's
   degree thesis for academic, educational, and non-commercial public
   consultation purposes, in accordance with institutional publication
   authorization. This does not grant commercial exploitation rights to
   the institution or to third parties.

5. NO WARRANTY
   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL
   THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY.

6. GOVERNING LAW
   This license shall be governed by the laws of the Republic of Colombia,
   without regard to conflict-of-law principles.

7. CONTACT
   For licensing inquiries: jhonkevinmurillom@gmail.com

---

Resumen en español:
Software propietario de Murillo Martínez Jhon Kevin (2026). Queda prohibida la
copia, modificación, distribución o explotación comercial sin autorización
escrita. El POLI JIC cuenta con autorización limitada, no exclusiva y sin
fines de lucro, para archivo y consulta académica de la versión entregada
como Trabajo de Grado. Los componentes de terceros se rigen por sus propias
licencias.
*/

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { InstitutionSettingEntity } from '../../database/entities/institution-setting.entity';
import { SchoolEntity } from '../../database/entities/school.entity';
import { UserRole } from '../../database/entities/user.entity';
import { formatTimeForDisplay } from '../../common/shift-schedule';
import { AuditService } from '../audit/audit.service';
import { FcmService } from '../fcm/fcm.service';
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

export type InstitutionShiftWindow = { start: string | null; end: string | null };

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
  /**
   * Horarios de jornada (solo lectura en campus). Configurables solo por ADMIN al crear/parchar escuela.
   */
  shiftWindows?: {
    matutino: InstitutionShiftWindow;
    vespertino: InstitutionShiftWindow;
    nocturno: InstitutionShiftWindow;
  } | null;
};

type JwtLike = { userId?: string | null; role: UserRole; schoolId?: string | null };

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  static shiftWindowsFromSchool(school: SchoolEntity): InstitutionProfile['shiftWindows'] {
    const pair = (a: string | null, b: string | null): InstitutionShiftWindow => ({
      start: formatTimeForDisplay(a),
      end: formatTimeForDisplay(b)
    });
    const m = pair(school.shiftMatutinoStart, school.shiftMatutinoEnd);
    const v = pair(school.shiftVespertinoStart, school.shiftVespertinoEnd);
    const n = pair(school.shiftNocturnoStart, school.shiftNocturnoEnd);
    const empty =
      !m.start &&
      !m.end &&
      !v.start &&
      !v.end &&
      !n.start &&
      !n.end;
    if (empty) return null;
    return { matutino: m, vespertino: v, nocturno: n };
  }

  constructor(
    @InjectRepository(InstitutionSettingEntity)
    private readonly settingsRepository: Repository<InstitutionSettingEntity>,
    @InjectRepository(SchoolEntity)
    private readonly schoolsRepository: Repository<SchoolEntity>,
    private readonly auditService: AuditService,
    private readonly fcmService: FcmService
  ) {}

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
      longitude: school.longitude ?? null,
      shiftWindows: SettingsService.shiftWindowsFromSchool(school)
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
  ): Promise<{ enabled: boolean }> {
    const schoolId = await this.resolveSchoolIdForCircuit(user, querySchoolId);
    const school = await this.schoolsRepository.findOne({
      where: { id: schoolId },
      select: ['id', 'circuitEnabled']
    });
    if (!school) throw new NotFoundException('Escuela no encontrada');
    return {
      enabled: school.circuitEnabled !== false
    };
  }

  async setCircuitSettings(
    user: JwtLike,
    dto: { enabled?: boolean },
    querySchoolId?: string
  ): Promise<{ enabled: boolean }> {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.ADMINISTRATIVO) {
      throw new ForbiddenException('No autorizado para cambiar el estado del circuito');
    }

    if (dto.enabled === undefined) {
      throw new BadRequestException('Indique el valor enabled.');
    }

    const schoolId = await this.resolveSchoolIdForCircuit(user, querySchoolId);
    const school = await this.schoolsRepository.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('Escuela no encontrada');
    const wasEnabled = school.circuitEnabled !== false;
    school.circuitEnabled = Boolean(dto.enabled);
    await this.schoolsRepository.save(school);
    if (wasEnabled && school.circuitEnabled === false) {
      const cancelled = await this.cancelOpenCircuitRequestsForSchool(school.id);
      await this.auditService
        .log(user.userId ?? null, 'school.circuit_module.disabled', 'schools', school.id, {
          schoolId: school.id,
          cancelledCount: cancelled.length
        })
        .catch(() => undefined);
      await this.notifyParentsCircuitDisabled(cancelled);
    }
    return {
      enabled: school.circuitEnabled !== false
    };
  }

  private async cancelOpenCircuitRequestsForSchool(
    schoolId: string
  ): Promise<Array<{ id: string; student_id: string; parent_user_id: string | null }>> {
    const raw = await this.schoolsRepository.manager.query<
      | Array<{ id: string; student_id: string; parent_user_id: string | null }>
      | [Array<{ id: string; student_id: string; parent_user_id: string | null }>, number]
    >(
      `WITH cancelled AS (
         UPDATE circuit_requests cr
         SET status = 'CANCELADO'::circuit_status,
             teacher_signal = NULL,
             parent_confirm_deadline_at = NULL,
             parent_confirm_deadline_started_at = NULL
         FROM students st
         WHERE st.id = cr.student_id
           AND st.school_id = $1
           AND cr.status = ANY($2::circuit_status[])
         RETURNING cr.id, cr.student_id, cr.requested_by_parent_id
       )
       SELECT c.id, c.student_id, p.user_id AS parent_user_id
       FROM cancelled c
       LEFT JOIN parents p ON p.id = c.requested_by_parent_id`,
      [
        schoolId,
        ['PENDIENTE', 'PADRE_EN_CAMINO', 'NOTIFICADO_LLEGADA', 'AUTORIZADO_SALIR', 'EN_CAMINO']
      ]
    );
    if (Array.isArray(raw) && raw.length === 2 && typeof raw[1] === 'number' && Array.isArray(raw[0])) {
      return raw[0];
    }
    return raw as Array<{ id: string; student_id: string; parent_user_id: string | null }>;
  }

  private async notifyParentsCircuitDisabled(
    rows: Array<{ id: string; student_id: string; parent_user_id: string | null }>
  ): Promise<void> {
    for (const row of rows) {
      if (!row.parent_user_id) continue;
      void this.fcmService
        .sendPushToUser(
          row.parent_user_id,
          'Circuito del día deshabilitado',
          'La institución deshabilitó el módulo de Circuito del día. Tu solicitud abierta fue cancelada.',
          {
            type: 'circuit',
            circuitRequestId: row.id,
            status: 'CANCELADO',
            openPath: `/app/circuito/${row.id}`
          }
        )
        .catch((err: unknown) => {
          this.logger.warn(`No se pudo notificar cancelación por desactivación de circuito: ${String(err)}`);
        });
    }
  }
}
