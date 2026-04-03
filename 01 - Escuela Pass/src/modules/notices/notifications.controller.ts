import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RegisterFcmTokenDto } from '../fcm/dto/register-fcm-token.dto';
import { UnregisterFcmTokenDto } from '../fcm/dto/unregister-fcm-token.dto';
import { FcmService } from '../fcm/fcm.service';
import { NoticesService } from './notices.service';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('notifications')
@UseGuards(JwtAuthGuard)
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
}
