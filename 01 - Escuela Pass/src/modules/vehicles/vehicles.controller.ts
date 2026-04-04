import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
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
}
