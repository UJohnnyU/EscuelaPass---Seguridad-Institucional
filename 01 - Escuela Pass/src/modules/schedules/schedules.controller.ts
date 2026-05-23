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
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateScheduleSlotDto } from './dto/create-schedule-slot.dto';
import { UpdateScheduleSlotDto } from './dto/update-schedule-slot.dto';
import { SchedulesService } from './schedules.service';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('schedules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  private parseSearchLimit(limitRaw: string | undefined): number | undefined {
    if (!limitRaw?.trim()) return undefined;
    const n = parseInt(limitRaw, 10);
    if (Number.isNaN(n)) return undefined;
    return Math.min(Math.max(n, 1), 100);
  }

  @Get('me/teacher')
  @Roles(UserRole.DOCENTE)
  listMySlotsAsTeacher(
    @Req() req: Request & { user: JwtUser },
    @Query('refDate') refDate: string | undefined
  ) {
    return this.schedulesService.listMySlotsAsTeacher(req.user.userId, refDate);
  }

  @Get('me/teacher/groups')
  @Roles(UserRole.DOCENTE, UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  listMyGroupsAsTeacher(
    @Req() req: Request & { user: JwtUser },
    @Query('q') q: string | undefined,
    @Query('limit') limitRaw: string | undefined
  ) {
    const opts = { q: q?.trim(), limit: this.parseSearchLimit(limitRaw) };
    return this.schedulesService.listMyGroupsAsTeacher(req.user.userId, req.user.role, opts);
  }

  @Get('me/student')
  @Roles(UserRole.ALUMNO)
  listMySlotsAsStudent(
    @Req() req: Request & { user: JwtUser },
    @Query('refDate') refDate: string | undefined,
    @Query('weekFrom') weekFrom: string | undefined
  ) {
    return this.schedulesService.listMySlotsAsStudent(req.user.userId, refDate, weekFrom);
  }

  @Get('parent/my-children')
  @Roles(UserRole.PADRE)
  listMyChildrenSlotsAsParent(
    @Req() req: Request & { user: JwtUser },
    @Query('weekFrom') weekFrom: string | undefined,
    @Query('weekTo') weekTo: string | undefined
  ) {
    return this.schedulesService.listMyChildrenSlotsAsParent(req.user.userId, { weekFrom, weekTo });
  }

  @Get('groups/:groupId')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE, UserRole.PADRE, UserRole.ALUMNO)
  listByGroup(
    @Param('groupId', new ParseUUIDPipe({ version: '4' })) groupId: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.schedulesService.listByGroup(groupId, req.user.userId, req.user.role);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  create(@Req() req: Request & { user: JwtUser }, @Body() dto: CreateScheduleSlotDto) {
    return this.schedulesService.create(req.user.userId, req.user.role, dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  update(
    @Req() req: Request & { user: JwtUser },
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateScheduleSlotDto
  ) {
    return this.schedulesService.update(req.user.userId, req.user.role, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  remove(
    @Req() req: Request & { user: JwtUser },
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string
  ) {
    return this.schedulesService.remove(req.user.userId, req.user.role, id);
  }
}
