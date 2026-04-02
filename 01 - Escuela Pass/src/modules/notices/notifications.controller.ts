import { Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NoticesService } from './notices.service';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly noticesService: NoticesService) {}

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

  @Patch(':id/read')
  markRead(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.noticesService.markAsRead(id, req.user.userId);
  }
}
