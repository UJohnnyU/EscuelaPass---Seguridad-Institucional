import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AcceptPrivacyDto } from './dto/accept-privacy.dto';
import { PrivacyService } from './privacy.service';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('privacy')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrivacyController {
  constructor(private readonly privacyService: PrivacyService) {}

  @Get('policy/latest')
  @Roles(
    UserRole.ADMIN,
    UserRole.ADMINISTRATIVO,
    UserRole.DOCENTE,
    UserRole.PADRE,
    UserRole.ALUMNO
  )
  latestPolicy() {
    return this.privacyService.getLatestPolicy();
  }

  @Get('me/acceptances')
  @Roles(
    UserRole.ADMIN,
    UserRole.ADMINISTRATIVO,
    UserRole.DOCENTE,
    UserRole.PADRE,
    UserRole.ALUMNO
  )
  myAcceptances(@Req() req: Request & { user: JwtUser }) {
    return this.privacyService.listMyAcceptances(req.user.userId);
  }

  @Post('accept')
  @Roles(
    UserRole.ADMIN,
    UserRole.ADMINISTRATIVO,
    UserRole.DOCENTE,
    UserRole.PADRE,
    UserRole.ALUMNO
  )
  accept(
    @Body() dto: AcceptPrivacyDto,
    @Req() req: Request & { user: JwtUser } & { ip?: string }
  ) {
    const ip = req.ip ?? (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
    return this.privacyService.accept(req.user.userId, dto.version, ip ?? null);
  }
}
