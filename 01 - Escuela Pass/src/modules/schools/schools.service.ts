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

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { assertWindowStartBeforeEnd, timeHmToSql } from '../../common/shift-schedule';
import { SchoolEntity } from '../../database/entities/school.entity';
import { AdministrativeStaffEntity } from '../../database/entities/administrative-staff.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { AssignUserSchoolDto } from './dto/assign-user-school.dto';
import { CreateSchoolDto } from './dto/create-school.dto';
import { SchoolShiftWindowsDto } from './dto/school-shift-windows.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { UpdateSchoolAdminUserDto } from './dto/update-school-admin-user.dto';

@Injectable()
export class SchoolsService {
  constructor(
    @InjectRepository(SchoolEntity)
    private readonly schoolsRepository: Repository<SchoolEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(AdministrativeStaffEntity)
    private readonly administrativeStaffRepository: Repository<AdministrativeStaffEntity>
  ) {}

  private applyShiftWindowsToSchoolOrThrow(school: SchoolEntity, w: SchoolShiftWindowsDto): void {
    try {
      assertWindowStartBeforeEnd(w.matutino.start, w.matutino.end);
      assertWindowStartBeforeEnd(w.vespertino.start, w.vespertino.end);
      assertWindowStartBeforeEnd(w.nocturno.start, w.nocturno.end);
      school.shiftMatutinoStart = timeHmToSql(w.matutino.start);
      school.shiftMatutinoEnd = timeHmToSql(w.matutino.end);
      school.shiftVespertinoStart = timeHmToSql(w.vespertino.start);
      school.shiftVespertinoEnd = timeHmToSql(w.vespertino.end);
      school.shiftNocturnoStart = timeHmToSql(w.nocturno.start);
      school.shiftNocturnoEnd = timeHmToSql(w.nocturno.end);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Horarios de jornada inválidos';
      throw new BadRequestException(msg);
    }
  }

  list() {
    return this.schoolsRepository.find({ order: { name: 'ASC' } });
  }

  async get(id: string) {
    const row = await this.schoolsRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Escuela no encontrada');
    return row;
  }

  async create(dto: CreateSchoolDto) {
    const existingByName = await this.schoolsRepository.findOne({ where: { name: dto.name.trim() } });
    if (existingByName) throw new ConflictException('Ya existe una escuela con ese nombre');
    const existingByCode = await this.schoolsRepository.findOne({ where: { code: dto.code.trim() } });
    if (existingByCode) throw new ConflictException('Ya existe una escuela con ese código');
    const passingGrade = dto.passingGrade ?? 0;
    if (passingGrade > dto.maxGradeScale) {
      throw new BadRequestException('La nota mínima aprobatoria no puede superar la escala máxima.');
    }
    const row = this.schoolsRepository.create({
      name: dto.name.trim(),
      code: dto.code.trim(),
      status: true,
      maxGradeScale: dto.maxGradeScale.toFixed(2),
      passingGrade: passingGrade.toFixed(2),
      minFailedSubjectsToRepeat: dto.minFailedSubjectsToRepeat ?? 3,
      latitude: dto.latitude.toFixed(8),
      longitude: dto.longitude.toFixed(8)
    });
    this.applyShiftWindowsToSchoolOrThrow(row, dto.shiftWindows);
    return this.schoolsRepository.save(row);
  }

  async update(id: string, dto: UpdateSchoolDto) {
    const row = await this.get(id);
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const clash = await this.schoolsRepository.findOne({ where: { name } });
      if (clash && clash.id !== row.id) throw new ConflictException('Ya existe una escuela con ese nombre');
      row.name = name;
    }
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.maxGradeScale !== undefined) row.maxGradeScale = dto.maxGradeScale.toFixed(2);
    if (dto.passingGrade !== undefined) {
      const scale = Number(row.maxGradeScale);
      if (dto.passingGrade > scale) {
        throw new BadRequestException('La nota mínima aprobatoria no puede superar la escala máxima.');
      }
      row.passingGrade = dto.passingGrade.toFixed(2);
    }
    if (dto.minFailedSubjectsToRepeat !== undefined) {
      row.minFailedSubjectsToRepeat = dto.minFailedSubjectsToRepeat;
    }
    if ((dto.latitude === undefined) !== (dto.longitude === undefined)) {
      throw new BadRequestException('Para actualizar ubicación debe enviar latitude y longitude juntos.');
    }
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      row.latitude = dto.latitude.toFixed(8);
      row.longitude = dto.longitude.toFixed(8);
    }
    if (dto.shiftWindows !== undefined) {
      this.applyShiftWindowsToSchoolOrThrow(row, dto.shiftWindows);
    }
    return this.schoolsRepository.save(row);
  }

  async assignUserSchool(dto: AssignUserSchoolDto) {
    const user = await this.usersRepository.findOne({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const school = await this.schoolsRepository.findOne({ where: { id: dto.schoolId } });
    if (!school) throw new NotFoundException('Escuela no encontrada');
    user.schoolId = school.id;
    await this.usersRepository.save(user);
    return {
      userId: user.id,
      role: user.role,
      schoolId: school.id
    };
  }

  async listUsersBySchool(schoolId: string) {
    const school = await this.get(schoolId);
    const users = await this.usersRepository.find({
      where: { schoolId: school.id },
      order: { fullName: 'ASC' }
    });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      fullName: u.fullName,
      status: u.status,
      phone: u.phone ?? null,
      canAccessCampus: u.canAccessCampus ?? false
    }));
  }

  async updateSchoolAdministrativeUser(schoolId: string, targetUserId: string, dto: UpdateSchoolAdminUserDto) {
    const school = await this.get(schoolId);
    const user = await this.usersRepository.findOne({ where: { id: targetUserId } });
    if (!user || user.schoolId !== school.id) {
      throw new NotFoundException('Usuario no encontrado en esta escuela');
    }
    if (user.role !== UserRole.ADMINISTRATIVO) {
      throw new BadRequestException('Solo puede editar personal con rol ADMINISTRATIVO de esta escuela');
    }

    let changed = false;
    if (dto.fullName !== undefined) {
      user.fullName = dto.fullName.trim();
      changed = true;
    }
    if (dto.phone !== undefined) {
      user.phone = dto.phone?.trim() || null;
      changed = true;
    }
    if (dto.canAccessCampus !== undefined) {
      user.canAccessCampus = dto.canAccessCampus;
      changed = true;
    }
    if (dto.status !== undefined) {
      user.status = dto.status;
      changed = true;
    }
    if (!changed) {
      throw new BadRequestException('Envíe al menos un campo para actualizar');
    }

    await this.usersRepository.save(user);
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      status: user.status,
      phone: user.phone,
      canAccessCampus: user.canAccessCampus
    };
  }

  async resetSchoolAdministrativePassword(schoolId: string, targetUserId: string, passwordHash: string) {
    const school = await this.get(schoolId);
    const user = await this.usersRepository.findOne({ where: { id: targetUserId } });
    if (!user || user.schoolId !== school.id) {
      throw new NotFoundException('Usuario no encontrado en esta escuela');
    }
    if (user.role !== UserRole.ADMINISTRATIVO) {
      throw new BadRequestException('Solo puede restablecer la contraseña de personal ADMINISTRATIVO');
    }
    user.passwordHash = passwordHash;
    await this.usersRepository.save(user);
    return { id: user.id, email: user.email };
  }

  async createSchoolAdmin(
    schoolId: string,
    payload: {
      email: string;
      fullName: string;
      passwordHash: string;
      phone?: string | null;
      canAccessCampus?: boolean;
    }
  ) {
    const school = await this.get(schoolId);
    const existing = await this.usersRepository.findOne({ where: { email: payload.email.trim() } });
    if (existing) throw new ConflictException('El correo ya está registrado');
    const user = this.usersRepository.create({
      email: payload.email.trim(),
      fullName: payload.fullName.trim(),
      passwordHash: payload.passwordHash,
      role: UserRole.ADMINISTRATIVO,
      canAccessCampus: payload.canAccessCampus ?? true,
      status: true,
      schoolId: school.id,
      phone: payload.phone?.trim() || null
    });
    const saved = await this.usersRepository.save(user);
    const staffRow = await this.administrativeStaffRepository.findOne({ where: { userId: saved.id } });
    if (!staffRow) {
      await this.administrativeStaffRepository.save(this.administrativeStaffRepository.create({ userId: saved.id }));
    }
    return {
      id: saved.id,
      email: saved.email,
      role: saved.role,
      schoolId: saved.schoolId
    };
  }
}
