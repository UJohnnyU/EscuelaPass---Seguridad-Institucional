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

import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminReportCommentDto } from './dto/admin-report-comment.dto';
import { CreateAdminReportDto } from './dto/create-admin-report.dto';
import { UpdateAdminReportStatusDto } from './dto/update-admin-report-status.dto';
import { RegisterFcmTokenDto } from '../fcm/dto/register-fcm-token.dto';
import { UnregisterFcmTokenDto } from '../fcm/dto/unregister-fcm-token.dto';
import { FcmService } from '../fcm/fcm.service';
import { NoticesService } from './notices.service';

type JwtUser = { userId: string; email: string; role: UserRole };

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(
    private readonly noticesService: NoticesService,
    private readonly fcmService: FcmService
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Listar notificaciones del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Lista paginada de notificaciones.' })
  listMine(
    @Req() req: Request & { user: JwtUser },
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined
  ) {
    const p = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
    const l = Math.min(100, Math.max(1, Number.parseInt(limit ?? '30', 10) || 30));
    return this.noticesService.listMyNotifications(req.user.userId, p, l);
  }

  @Get('parent/my-children')
  @Roles(UserRole.PADRE)
  @ApiOperation({ summary: 'Notificaciones de los hijos del padre autenticado' })
  listChildrenNotifications(
    @Req() req: Request & { user: JwtUser },
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined
  ) {
    const p = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
    const l = Math.min(100, Math.max(1, Number.parseInt(limit ?? '30', 10) || 30));
    return this.noticesService.listMyChildrenNotifications(req.user.userId, p, l);
  }

  @Post('fcm/register')
  @ApiOperation({ summary: 'Registrar token FCM del dispositivo para push notifications' })
  @ApiResponse({ status: 201, description: 'Token registrado correctamente.' })
  registerFcmToken(@Body() dto: RegisterFcmTokenDto, @Req() req: Request & { user: JwtUser }) {
    return this.fcmService.registerDeviceToken(req.user.userId, dto);
  }

  @Post('fcm/unregister')
  @ApiOperation({ summary: 'Eliminar token FCM del dispositivo' })
  unregisterFcmToken(@Body() dto: UnregisterFcmTokenDto, @Req() req: Request & { user: JwtUser }) {
    return this.fcmService.unregisterDeviceToken(req.user.userId, dto.token);
  }

  @Get('admin-reports/sla-summary')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Resumen SLA de tickets / reportes a administración' })
  adminReportsSlaSummary(
    @Req() req: Request & { user: JwtUser },
    @Query('schoolId') schoolId?: string
  ) {
    return this.noticesService.getAdminReportsSlaSummary(req.user.userId, req.user.role, schoolId);
  }

  @Get('admin-reports/mine')
  @Roles(UserRole.ADMINISTRATIVO)
  listMyAdminReports(
    @Req() req: Request & { user: JwtUser },
    @Query('limit') limit?: string
  ) {
    return this.noticesService.listMyAdminReports(req.user.userId, req.user.role, { limit });
  }

  @Get('admin-reports')
  @Roles(UserRole.ADMIN)
  listAdminReports(
    @Req() req: Request & { user: JwtUser },
    @Query('schoolId') schoolId?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string
  ) {
    return this.noticesService.listAdminReports(req.user.userId, req.user.role, {
      schoolId,
      type,
      status,
      q,
      unreadOnly,
      limit
    });
  }

  @Post('admin-reports/sla-reminders/run')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Ejecutar recordatorios FCM sobre comunicados críticos pendientes de leer (SLA comunicación).' })
  runCriticalSlaReminders(
    @Req() req: Request & { user: JwtUser },
    @Query('schoolId') schoolId?: string
  ) {
    return this.noticesService.runAdminReportsSlaReminders(req.user.userId, req.user.role, schoolId);
  }

  @Post('admin-reports')
  @HttpCode(201)
  @Roles(
    UserRole.PADRE,
    UserRole.ALUMNO,
    UserRole.DOCENTE,
    UserRole.ADMINISTRATIVO,
    UserRole.ADMIN
  )
  createAdminReport(@Body() dto: CreateAdminReportDto, @Req() req: Request & { user: JwtUser }) {
    return this.noticesService.createAdminReport(dto, req.user.userId, req.user.role);
  }

  @Get('admin-reports/:reportId/comments')
  @Roles(
    UserRole.ADMIN,
    UserRole.ADMINISTRATIVO,
    UserRole.DOCENTE,
    UserRole.PADRE,
    UserRole.ALUMNO
  )
  listAdminReportComments(
    @Param('reportId', new ParseUUIDPipe({ version: '4' })) reportId: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.noticesService.listAdminReportComments(reportId, req.user.userId, req.user.role);
  }

  @Post('admin-reports/:reportId/comments')
  @HttpCode(201)
  @Roles(
    UserRole.ADMIN,
    UserRole.ADMINISTRATIVO,
    UserRole.DOCENTE,
    UserRole.PADRE,
    UserRole.ALUMNO
  )
  addAdminReportComment(
    @Param('reportId', new ParseUUIDPipe({ version: '4' })) reportId: string,
    @Body() dto: AdminReportCommentDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.noticesService.addAdminReportComment(reportId, dto, req.user.userId, req.user.role);
  }

  @Patch('admin-reports/:reportId/status')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  updateAdminReportStatus(
    @Param('reportId', new ParseUUIDPipe({ version: '4' })) reportId: string,
    @Body() dto: UpdateAdminReportStatusDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.noticesService.updateAdminReportStatus(reportId, dto, req.user.userId, req.user.role);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar notificación como leída' })
  markRead(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.noticesService.markAsRead(id, req.user.userId);
  }
}
