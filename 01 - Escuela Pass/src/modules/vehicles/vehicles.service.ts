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

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParentEntity } from '../../database/entities/parent.entity';
import { UserRole } from '../../database/entities/user.entity';
import { VehicleEntity } from '../../database/entities/vehicle.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

type StaffViewer = { role: UserRole; schoolId?: string | null };

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(VehicleEntity)
    private readonly vehiclesRepository: Repository<VehicleEntity>,
    @InjectRepository(ParentEntity)
    private readonly parentsRepository: Repository<ParentEntity>
  ) {}

  private async getParentOrThrow(parentUserId: string) {
    const parent = await this.parentsRepository.findOne({ where: { userId: parentUserId } });
    if (!parent) throw new ForbiddenException('Perfil padre no encontrado');
    return parent;
  }

  private async persistNewVehicleRow(
    parentEntityId: string,
    dto: CreateVehicleDto,
    duplicatePlateMessage: string
  ): Promise<VehicleEntity> {
    const row = this.vehiclesRepository.create({
      parentId: parentEntityId,
      plate: dto.plate.trim().toUpperCase(),
      description: dto.description?.trim() ?? null,
      brand: dto.brand?.trim() ?? null,
      model: dto.model?.trim() ?? null,
      color: dto.color?.trim() ?? null,
      year: dto.year ?? null,
      isActive: true
    });
    try {
      return await this.vehiclesRepository.save(row);
    } catch (e: unknown) {
      const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
      if (code === '23505') {
        throw new ForbiddenException(duplicatePlateMessage);
      }
      throw e;
    }
  }

  private async parentSchoolIdOrThrow(parentId: string): Promise<string> {
    const row = await this.parentsRepository
      .createQueryBuilder('p')
      .innerJoin('users', 'u', 'u.id = p.userId')
      .select('u.school_id', 'schoolId')
      .where('p.id = :id', { id: parentId })
      .getRawOne<{ schoolId: string | null }>();
    if (!row?.schoolId) throw new NotFoundException('Padre/tutor no encontrado');
    return row.schoolId;
  }

  /** Admin multi-escuela o administrativo: listar tras validar institución cuando aplica. */
  async listByParentIdForStaff(parentId: string, viewer: StaffViewer): Promise<VehicleEntity[]> {
    const schoolId = await this.parentSchoolIdOrThrow(parentId);
    if (viewer.role === UserRole.ADMINISTRATIVO) {
      if (!viewer.schoolId || viewer.schoolId !== schoolId) {
        throw new ForbiddenException('No autorizado');
      }
    }
    return this.listByParentId(parentId);
  }

  /** Docente/personal en Grupos y personas: alta de vehículo para un tutor. */
  async staffCreateVehicleForParent(parentId: string, dto: CreateVehicleDto): Promise<VehicleEntity> {
    const parent = await this.parentsRepository.findOne({ where: { id: parentId } });
    if (!parent) throw new NotFoundException('Padre/tutor no encontrado');
    return this.persistNewVehicleRow(
      parent.id,
      dto,
      'Ya existe un vehículo con esa placa para este tutor'
    );
  }

  async staffUpdateVehicleForParent(parentId: string, vehicleId: string, dto: UpdateVehicleDto): Promise<VehicleEntity> {
    const v = await this.vehiclesRepository.findOne({ where: { id: vehicleId, parentId } });
    if (!v) throw new NotFoundException('Vehículo no encontrado');
    if (dto.description !== undefined) v.description = dto.description?.trim() ?? null;
    if (dto.brand !== undefined) v.brand = dto.brand?.trim() ?? null;
    if (dto.model !== undefined) v.model = dto.model?.trim() ?? null;
    if (dto.color !== undefined) v.color = dto.color?.trim() ?? null;
    if (dto.year !== undefined) v.year = dto.year ?? null;
    if (dto.isActive !== undefined) v.isActive = dto.isActive;
    return this.vehiclesRepository.save(v);
  }

  async staffDeleteVehicleForParent(parentId: string, vehicleId: string): Promise<{ message: string; id: string }> {
    const v = await this.vehiclesRepository.findOne({ where: { id: vehicleId, parentId } });
    if (!v) throw new NotFoundException('Vehículo no encontrado');
    await this.vehiclesRepository.delete({ id: vehicleId });
    return { message: 'Vehículo eliminado', id: vehicleId };
  }

  private async assertStaffCanManageVehicle(vehicleId: string, viewer: StaffViewer): Promise<VehicleEntity> {
    const v = await this.vehiclesRepository.findOne({ where: { id: vehicleId } });
    if (!v) throw new NotFoundException('Vehículo no encontrado');
    if (viewer.role === UserRole.ADMINISTRATIVO) {
      const schoolId = await this.parentSchoolIdOrThrow(v.parentId);
      if (!viewer.schoolId || viewer.schoolId !== schoolId) {
        throw new ForbiddenException('No autorizado');
      }
    }
    return v;
  }

  /** Activa/desactiva con alcance institucional para administrativos. */
  async adminSetActiveScoped(vehicleId: string, isActive: boolean, viewer: StaffViewer): Promise<VehicleEntity> {
    const v = await this.assertStaffCanManageVehicle(vehicleId, viewer);
    v.isActive = isActive;
    return this.vehiclesRepository.save(v);
  }

  async adminDeleteScoped(vehicleId: string, viewer: StaffViewer): Promise<{ message: string; id: string }> {
    await this.assertStaffCanManageVehicle(vehicleId, viewer);
    await this.vehiclesRepository.delete({ id: vehicleId });
    return { message: 'Vehículo eliminado', id: vehicleId };
  }

  async listMine(parentUserId: string) {
    const parent = await this.getParentOrThrow(parentUserId);
    return this.vehiclesRepository.find({
      where: { parentId: parent.id },
      order: { createdAt: 'DESC' }
    });
  }

  /** Admin/Administrativo: listar vehículos de un padre por su ID de perfil (parent.id). */
  async listByParentId(parentId: string) {
    return this.vehiclesRepository.find({
      where: { parentId },
      order: { createdAt: 'DESC' }
    });
  }

  async create(parentUserId: string, dto: CreateVehicleDto) {
    const parent = await this.getParentOrThrow(parentUserId);
    return this.persistNewVehicleRow(parent.id, dto, 'Ya existe un vehículo con esa placa en tu cuenta');
  }

  async update(parentUserId: string, vehicleId: string, dto: UpdateVehicleDto) {
    const parent = await this.getParentOrThrow(parentUserId);
    const v = await this.vehiclesRepository.findOne({ where: { id: vehicleId, parentId: parent.id } });
    if (!v) throw new NotFoundException('Vehículo no encontrado');
    if (dto.description !== undefined) v.description = dto.description?.trim() ?? null;
    if (dto.brand !== undefined) v.brand = dto.brand?.trim() ?? null;
    if (dto.model !== undefined) v.model = dto.model?.trim() ?? null;
    if (dto.color !== undefined) v.color = dto.color?.trim() ?? null;
    if (dto.year !== undefined) v.year = dto.year ?? null;
    if (dto.isActive !== undefined) v.isActive = dto.isActive;
    return this.vehiclesRepository.save(v);
  }

  /** Padre: eliminar un vehículo propio. */
  async deleteMine(parentUserId: string, vehicleId: string) {
    const parent = await this.getParentOrThrow(parentUserId);
    const v = await this.vehiclesRepository.findOne({ where: { id: vehicleId, parentId: parent.id } });
    if (!v) throw new NotFoundException('Vehículo no encontrado');
    await this.vehiclesRepository.delete({ id: vehicleId });
    return { message: 'Vehículo eliminado', id: vehicleId };
  }
}
