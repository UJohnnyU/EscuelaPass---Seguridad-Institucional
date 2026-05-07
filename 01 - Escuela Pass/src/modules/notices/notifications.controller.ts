import { Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
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

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar notificación como leída' })
  markRead(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.noticesService.markAsRead(id, req.user.userId);
  }
}
