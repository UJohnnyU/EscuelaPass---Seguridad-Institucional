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
