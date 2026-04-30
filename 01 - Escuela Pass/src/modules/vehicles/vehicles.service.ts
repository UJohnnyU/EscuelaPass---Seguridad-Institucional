import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParentEntity } from '../../database/entities/parent.entity';
import { VehicleEntity } from '../../database/entities/vehicle.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

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
    const row = this.vehiclesRepository.create({
      parentId: parent.id,
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
        throw new ForbiddenException('Ya existe un vehículo con esa placa en tu cuenta');
      }
      throw e;
    }
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

  /** Admin/Administrativo: desactivar o activar vehículo de cualquier padre. */
  async adminSetActive(vehicleId: string, isActive: boolean) {
    const v = await this.vehiclesRepository.findOne({ where: { id: vehicleId } });
    if (!v) throw new NotFoundException('Vehículo no encontrado');
    v.isActive = isActive;
    return this.vehiclesRepository.save(v);
  }

  /** Admin/Administrativo: eliminar vehículo de cualquier padre. */
  async adminDelete(vehicleId: string) {
    const v = await this.vehiclesRepository.findOne({ where: { id: vehicleId } });
    if (!v) throw new NotFoundException('Vehículo no encontrado');
    await this.vehiclesRepository.delete({ id: vehicleId });
    return { message: 'Vehículo eliminado', id: vehicleId };
  }
}
