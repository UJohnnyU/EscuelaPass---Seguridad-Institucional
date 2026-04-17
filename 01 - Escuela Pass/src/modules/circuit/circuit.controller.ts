import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CircuitService } from './circuit.service';
import { CreateCircuitRequestDto } from './dto/create-circuit-request.dto';
import { UpdateCircuitGpsDto } from './dto/update-circuit-gps.dto';
import { UpdateParentCircuitProgressDto } from './dto/update-parent-circuit-progress.dto';
import { UpdateCircuitStatusDto } from './dto/update-circuit-status.dto';
import { UpdateTeacherCircuitSignalDto } from './dto/update-teacher-circuit-signal.dto';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('circuit-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CircuitController {
  constructor(private readonly circuitService: CircuitService) {}

  @Post()
  @Roles(UserRole.PADRE, UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  create(@Body() payload: CreateCircuitRequestDto) {
    return this.circuitService.create(payload);
  }

  @Get('today')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  findToday() {
    return this.circuitService.findToday();
  }

  /** Solicitud en curso del padre (si existe); para redirigir al detalle sin pasar por el formulario nuevo. */
  @Get('parent/active')
  @Roles(UserRole.PADRE)
  findParentActive(@Req() req: Request & { user: JwtUser }) {
    return this.circuitService.findActiveForParentUser(req.user.userId).then((active) => ({ active }));
  }

  @Patch(':id/gps')
  @Roles(UserRole.PADRE)
  updateGps(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateCircuitGpsDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.circuitService.updateParentGps(id, req.user.userId, dto);
  }

  @Patch(':id/parent-progress')
  @Roles(UserRole.PADRE)
  advanceParentProgress(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateParentCircuitProgressDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.circuitService.advanceParentProgress(id, req.user.userId, dto);
  }

  @Get(':id/map')
  @Header('Cache-Control', 'no-store, must-revalidate')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE, UserRole.PADRE)
  getMapContext(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.circuitService.getMapContext(id, req.user.userId, req.user.role);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store, must-revalidate')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE, UserRole.PADRE)
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.circuitService.findByIdForViewer(id, req.user.userId, req.user.role);
  }

  @Patch(':id/teacher-signal')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  setTeacherSignal(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateTeacherCircuitSignalDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.circuitService.setTeacherSignal(id, dto, req.user.userId, req.user.role);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  updateStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateCircuitStatusDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.circuitService.updateStatus(id, dto, req.user.userId, req.user.role);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.PADRE)
  cancel(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Req() req: Request & { user: JwtUser }) {
    return this.circuitService.cancel(id, req.user.userId);
  }

  @Patch(':id/confirm-delivered')
  @Roles(UserRole.PADRE, UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  confirmDelivered(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.circuitService.confirmDelivered(id, req.user.userId, req.user.role);
  }
}
