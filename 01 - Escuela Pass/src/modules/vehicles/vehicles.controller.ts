import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehiclesService } from './vehicles.service';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('parents/vehicles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  @Roles(UserRole.PADRE)
  listMine(@Req() req: Request & { user: JwtUser }) {
    return this.vehiclesService.listMine(req.user.userId);
  }

  /** Admin/Administrativo: listar vehículos de un padre por su ID de perfil (parent entity id). */
  @Get('by-parent/:parentId')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  listByParent(
    @Param('parentId', new ParseUUIDPipe({ version: '4' })) parentId: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.vehiclesService.listByParentIdForStaff(parentId, req.user);
  }

  @Post()
  @Roles(UserRole.PADRE)
  create(@Body() dto: CreateVehicleDto, @Req() req: Request & { user: JwtUser }) {
    return this.vehiclesService.create(req.user.userId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.PADRE)
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateVehicleDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.vehiclesService.update(req.user.userId, id, dto);
  }

  /** Padre: eliminar uno de sus vehículos. */
  @Delete(':id')
  @Roles(UserRole.PADRE)
  deleteMine(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.vehiclesService.deleteMine(req.user.userId, id);
  }

  /** Admin/Administrativo: activar/desactivar cualquier vehículo. */
  @Patch(':id/set-active')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  adminSetActive(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: { isActive: boolean },
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.vehiclesService.adminSetActiveScoped(id, body.isActive, req.user);
  }

  /** Admin/Administrativo: eliminar cualquier vehículo. */
  @Delete(':id/admin')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  adminDelete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.vehiclesService.adminDeleteScoped(id, req.user);
  }
}
