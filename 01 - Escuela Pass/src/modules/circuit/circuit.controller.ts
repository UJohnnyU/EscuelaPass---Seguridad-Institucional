import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CircuitService } from './circuit.service';
import { CreateBatchCircuitRequestDto } from './dto/create-batch-circuit-request.dto';
import { CreateCircuitRequestDto } from './dto/create-circuit-request.dto';
import { UpdateCircuitGpsDto } from './dto/update-circuit-gps.dto';
import { UpdateParentCircuitProgressDto } from './dto/update-parent-circuit-progress.dto';
import { UpdateCircuitStatusDto } from './dto/update-circuit-status.dto';
import { UpdateTeacherCircuitSignalDto } from './dto/update-teacher-circuit-signal.dto';

type JwtUser = { userId: string; email: string; role: UserRole };

/** Acepta cualquier UUID RFC (v4, v7, etc.); coincide con `uuid` en PostgreSQL. */
const circuitIdPipe = new ParseUUIDPipe();

@ApiTags('circuit-requests')
@ApiBearerAuth()
@Controller('circuit-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CircuitController {
  constructor(private readonly circuitService: CircuitService) {}

  @Post()
  @Roles(UserRole.PADRE, UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  @ApiOperation({ summary: 'Crear solicitud de circuito de recogida' })
  @ApiResponse({ status: 201, description: 'Solicitud creada.' })
  create(@Body() payload: CreateCircuitRequestDto) {
    return this.circuitService.create(payload);
  }

  @Post('batch')
  @Roles(UserRole.PADRE, UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  @ApiOperation({ summary: 'Crear solicitudes de circuito para múltiples hijos' })
  createBatch(@Body() payload: CreateBatchCircuitRequestDto) {
    return this.circuitService.createBatch(payload);
  }

  @Get('today')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  @ApiOperation({ summary: 'Solicitudes de circuito del día (vista staff)' })
  findToday(
    @Req() req: Request & { user: JwtUser },
    @Query('schoolId') schoolId?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string
  ) {
    return this.circuitService.findToday(req.user.userId, req.user.role, schoolId, q, limit);
  }

  /** Solicitud en curso del padre (primera activa hoy); para compatibilidad con flujo de un solo hijo. */
  @Get('parent/active')
  @Roles(UserRole.PADRE)
  findParentActive(@Req() req: Request & { user: JwtUser }) {
    return this.circuitService.findActiveForParentUser(req.user.userId).then((active) => ({ active }));
  }

  /** Todas las solicitudes activas del padre hoy (multi-hijo). */
  @Get('parent/active-all')
  @Roles(UserRole.PADRE)
  findParentActiveAll(@Req() req: Request & { user: JwtUser }) {
    return this.circuitService.findAllActiveForParentUser(req.user.userId).then((active) => ({ active }));
  }

  @Patch(':id/gps')
  @Roles(UserRole.PADRE)
  @ApiOperation({ summary: 'Actualizar GPS del padre — activa auto-transición a NOTIFICADO_LLEGADA al entrar al radio' })
  @ApiResponse({ status: 200, description: 'Ubicación actualizada. autoTransitioned=true si el padre entró al radio.' })
  updateGps(
    @Param('id', circuitIdPipe) id: string,
    @Body() dto: UpdateCircuitGpsDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.circuitService.updateParentGps(id, req.user.userId, dto);
  }

  @Patch(':id/parent-progress')
  @Roles(UserRole.PADRE)
  @ApiOperation({ summary: 'Avanzar estado del circuito (padre): solo PADRE_EN_CAMINO es válido; NOTIFICADO_LLEGADA se activa automáticamente por GPS' })
  advanceParentProgress(
    @Param('id', circuitIdPipe) id: string,
    @Body() dto: UpdateParentCircuitProgressDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.circuitService.advanceParentProgress(id, req.user.userId, dto);
  }

  @Get(':id/map')
  @Header('Cache-Control', 'no-store, must-revalidate')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE, UserRole.PADRE)
  getMapContext(
    @Param('id', circuitIdPipe) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.circuitService.getMapContext(id, req.user.userId, req.user.role);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store, must-revalidate')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE, UserRole.PADRE)
  findOne(
    @Param('id', circuitIdPipe) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.circuitService.findByIdForViewer(id, req.user.userId, req.user.role);
  }

  @Patch(':id/teacher-signal')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  setTeacherSignal(
    @Param('id', circuitIdPipe) id: string,
    @Body() dto: UpdateTeacherCircuitSignalDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.circuitService.setTeacherSignal(id, dto, req.user.userId, req.user.role);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  @ApiOperation({ summary: 'Cambiar estado del circuito (staff). Al pasar a AUTORIZADO_SALIR, se establece teacherSignal=ALUMNO_CAMINO_A_SALIDA automáticamente.' })
  updateStatus(
    @Param('id', circuitIdPipe) id: string,
    @Body() dto: UpdateCircuitStatusDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.circuitService.updateStatus(id, dto, req.user.userId, req.user.role);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.PADRE)
  cancel(@Param('id', circuitIdPipe) id: string, @Req() req: Request & { user: JwtUser }) {
    return this.circuitService.cancel(id, req.user.userId);
  }

  @Patch(':id/confirm-delivered')
  @Roles(UserRole.PADRE, UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  confirmDelivered(
    @Param('id', circuitIdPipe) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.circuitService.confirmDelivered(id, req.user.userId, req.user.role);
  }
}
