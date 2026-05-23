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
import { CancelMeetingDto } from './dto/cancel-meeting.dto';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { MeetingRsvpDto } from './dto/meeting-rsvp.dto';
import { MeetingStatusDto } from './dto/meeting-status.dto';
import { RescheduleMeetingDto } from './dto/reschedule-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { MeetingsService } from './meetings.service';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('meetings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  create(
    @Body() dto: CreateMeetingDto,
    @Req() req: Request & { user: JwtUser },
    @Query('schoolId') schoolId?: string
  ) {
    return this.meetingsService.create(dto, req.user.userId, req.user.role, schoolId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  list(@Req() req: Request & { user: JwtUser }, @Query('schoolId') schoolId?: string) {
    return this.meetingsService.listForStaff({ userId: req.user.userId, role: req.user.role }, schoolId);
  }

  @Get('me')
  @Roles(
    UserRole.PADRE,
    UserRole.ALUMNO,
    UserRole.DOCENTE,
    UserRole.ADMINISTRATIVO,
    UserRole.ADMIN
  )
  listMine(@Req() req: Request & { user: JwtUser }) {
    return this.meetingsService.listMine(req.user.userId);
  }

  @Get(':id')
  @Roles(
    UserRole.PADRE,
    UserRole.ALUMNO,
    UserRole.DOCENTE,
    UserRole.ADMINISTRATIVO,
    UserRole.ADMIN
  )
  detail(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.meetingsService.getDetail(id, req.user.userId, req.user.role);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateMeetingDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.meetingsService.update(id, dto, req.user.userId, req.user.role);
  }

  @Post(':id/reschedule')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  reschedule(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: RescheduleMeetingDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.meetingsService.reschedule(id, dto, req.user.userId, req.user.role);
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  cancel(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CancelMeetingDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.meetingsService.cancel(id, dto, req.user.userId, req.user.role);
  }

  @Post(':id/status')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  status(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: MeetingStatusDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.meetingsService.changeStatus(id, dto, req.user.userId, req.user.role);
  }

  @Post(':id/rsvp')
  @Roles(
    UserRole.PADRE,
    UserRole.ALUMNO,
    UserRole.DOCENTE,
    UserRole.ADMINISTRATIVO,
    UserRole.ADMIN
  )
  rsvp(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: MeetingRsvpDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.meetingsService.rsvp(id, dto, req.user.userId, req.user.role);
  }
}
