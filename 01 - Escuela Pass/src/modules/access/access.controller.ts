import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AccessService } from './access.service';
import { RegisterAccessEventDto } from './dto/register-access-event.dto';

type JwtReq = Request & { user: { userId: string; email: string; role: UserRole } };

@Controller('access-events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  /** Valor QR para el usuario autenticado (pantalla de perfil / asistencia). */
  @Get('my-qr')
  getMyQr(@Req() req: JwtReq) {
    return this.accessService.getOrCreateQrForUser(req.user.userId);
  }

  @Post('scan')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  scan(@Body() payload: RegisterAccessEventDto) {
    return this.accessService.scanAccess(payload);
  }
}
