import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminReportCommentDto } from './dto/admin-report-comment.dto';
import { RegisterFcmTokenDto } from '../fcm/dto/register-fcm-token.dto';
import { UnregisterFcmTokenDto } from '../fcm/dto/unregister-fcm-token.dto';
import { FcmService } from '../fcm/fcm.service';
import { CreateAdminReportDto } from './dto/create-admin-report.dto';
import { UpdateAdminReportStatusDto } from './dto/update-admin-report-status.dto';
import { NoticesService } from './notices.service';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(
    private readonly noticesService: NoticesService,
    private readonly fcmService: FcmService
  ) {}

  @Get('me')
  listMine(
    @Req() req: Request & { user: JwtUser },
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined
  ) {
    const p = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
    const l = Math.min(100, Math.max(1, Number.parseInt(limit ?? '30', 10) || 30));
    return this.noticesService.listMyNotifications(req.user.userId, p, l);
  }

  @Get('admin-reports')
  @Roles(UserRole.ADMIN)
  listAdminReports(
    @Req() req: Request & { user: JwtUser },
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('type') type: string | undefined,
    @Query('status') status: string | undefined,
    @Query('q') q: string | undefined,
    @Query('unreadOnly') unreadOnly: string | undefined,
    @Query('schoolId') schoolId: string | undefined
  ) {
    const p = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
    const l = Math.min(100, Math.max(1, Number.parseInt(limit ?? '20', 10) || 20));
    return this.noticesService.listAdminReports(req.user.userId, {
      page: p,
      limit: l,
      type: type?.trim() || undefined,
      status: status?.trim() || undefined,
      q: q?.trim() || undefined,
      unreadOnly: unreadOnly === 'true',
      schoolId: schoolId?.trim() || undefined
    });
  }

  @Get('admin-reports/mine')
  @Roles(UserRole.ADMINISTRATIVO)
  listMyAdminReports(
    @Req() req: Request & { user: JwtUser },
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined
  ) {
    const p = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
    const l = Math.min(100, Math.max(1, Number.parseInt(limit ?? '20', 10) || 20));
    return this.noticesService.listMyAdminReports(req.user.userId, p, l);
  }

  @Patch('admin-reports/:id/status')
  @Roles(UserRole.ADMIN)
  updateAdminReportStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateAdminReportStatusDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.noticesService.updateAdminReportStatus(id, req.user.userId, dto.status, req.user.role);
  }

  @Get('admin-reports/:id/comments')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  listAdminReportComments(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.noticesService.listAdminReportComments(id, req.user.userId, req.user.role);
  }

  @Post('admin-reports/:id/comments')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  addAdminReportComment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AdminReportCommentDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.noticesService.addAdminReportComment(id, req.user.userId, req.user.role, dto.message);
  }

  @Get('parent/my-children')
  @Roles(UserRole.PADRE)
  listChildrenNotifications(
    @Req() req: Request & { user: JwtUser },
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined
  ) {
    const p = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
    const l = Math.min(100, Math.max(1, Number.parseInt(limit ?? '30', 10) || 30));
    return this.noticesService.listMyChildrenNotifications(req.user.userId, p, l);
  }

  /** Registra el token FCM del dispositivo para recibir push (Firebase Cloud Messaging). */
  @Post('fcm/register')
  registerFcmToken(@Body() dto: RegisterFcmTokenDto, @Req() req: Request & { user: JwtUser }) {
    return this.fcmService.registerDeviceToken(req.user.userId, dto);
  }

  @Post('fcm/unregister')
  unregisterFcmToken(@Body() dto: UnregisterFcmTokenDto, @Req() req: Request & { user: JwtUser }) {
    return this.fcmService.unregisterDeviceToken(req.user.userId, dto.token);
  }

  @Patch(':id/read')
  markRead(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.noticesService.markAsRead(id, req.user.userId);
  }

  /**
   * Canal interno: el personal administrativo reporta incidencias/sugerencias
   * al equipo administrador para ajustes operativos del sistema.
   */
  @Post('admin-reports')
  @Roles(UserRole.ADMINISTRATIVO)
  createAdminReport(
    @Body() dto: CreateAdminReportDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.noticesService.createAdminReport(dto, req.user.userId, req.user.role);
  }
}
