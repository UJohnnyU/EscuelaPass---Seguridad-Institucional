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
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { Request } from 'express';
import { ActivityStatus } from '../../database/entities/activity.entity';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { SaveActivityGradesDto } from './dto/save-activity-grade.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('activities')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  @Header('Cache-Control', 'no-store, must-revalidate')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  list(
    @Req() req: Request & { user: JwtUser },
    @Query('groupId') groupId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('periodId') periodId?: string,
    @Query('status') status?: string,
    @Query('schoolId') schoolId?: string
  ) {
    const normalizedStatus =
      status && (status === 'OPEN' || status === 'CLOSED')
        ? (status as ActivityStatus)
        : undefined;
    return this.activitiesService.list(req.user.userId, req.user.role, {
      groupId: groupId?.trim() || null,
      subjectId: subjectId?.trim() || null,
      periodId: periodId?.trim() || null,
      status: normalizedStatus ?? null,
      schoolId: schoolId?.trim() || null
    });
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  create(@Body() dto: CreateActivityDto, @Req() req: Request & { user: JwtUser }) {
    return this.activitiesService.create(dto, req.user.userId, req.user.role);
  }

  @Get('teacher/my-assignments')
  @Header('Cache-Control', 'no-store, must-revalidate')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  listTeacherAssignments(
    @Req() req: Request & { user: JwtUser },
    @Query('schoolId') schoolId?: string
  ) {
    const filter =
      req.user.role === UserRole.ADMIN && schoolId?.trim() ? schoolId.trim() : undefined;
    return this.activitiesService.listTeacherAssignments(req.user.userId, req.user.role, filter);
  }

  @Get('student/me')
  @Header('Cache-Control', 'no-store, must-revalidate')
  @Roles(UserRole.ALUMNO)
  listForStudent(
    @Req() req: Request & { user: JwtUser },
    @Query('periodId') periodId?: string
  ) {
    return this.activitiesService.listForStudentUser(req.user.userId, {
      periodId: periodId?.trim() || null
    });
  }

  @Get('parent/my-children')
  @Header('Cache-Control', 'no-store, must-revalidate')
  @Roles(UserRole.PADRE)
  listForParent(
    @Req() req: Request & { user: JwtUser },
    @Query('studentId') studentId?: string,
    @Query('periodId') periodId?: string
  ) {
    return this.activitiesService.listForParent(req.user.userId, {
      studentId: studentId?.trim() || null,
      periodId: periodId?.trim() || null
    });
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store, must-revalidate')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  getBoard(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.activitiesService.getBoard(id, req.user.userId, req.user.role);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateActivityDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.activitiesService.update(id, dto, req.user.userId, req.user.role);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.activitiesService.remove(id, req.user.userId, req.user.role);
  }

  @Post(':id/close')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  close(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.activitiesService.close(id, req.user.userId, req.user.role);
  }

  @Post(':id/reopen')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  reopen(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.activitiesService.reopen(id, req.user.userId, req.user.role);
  }

  @Post(':id/grades')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  saveGrades(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: SaveActivityGradesDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.activitiesService.saveGrades(id, dto, req.user.userId, req.user.role);
  }
}
