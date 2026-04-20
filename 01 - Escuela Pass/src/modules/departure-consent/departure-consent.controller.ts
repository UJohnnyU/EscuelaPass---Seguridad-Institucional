import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DepartureConsentService } from './departure-consent.service';
import { SetDepartureConsentDto } from './dto/set-departure-consent.dto';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('departure-consent')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepartureConsentController {
  constructor(private readonly service: DepartureConsentService) {}

  @Get('parent/today')
  @Roles(UserRole.PADRE)
  listTodayForParent(@Req() req: Request & { user: JwtUser }) {
    return this.service.listTodayForParent(req.user.userId);
  }

  @Get('student/me/today')
  @Roles(UserRole.ALUMNO)
  statusStudent(@Req() req: Request & { user: JwtUser }) {
    return this.service.statusForStudentUser(req.user.userId);
  }

  @Post('parent/set')
  @Roles(UserRole.PADRE)
  setForParent(@Req() req: Request & { user: JwtUser }, @Body() dto: SetDepartureConsentDto) {
    const date = (dto.date ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
    return this.service.setAutonomousForParent(req.user.userId, dto.studentId, date, dto.active);
  }

  /** Docentes/staff: mapa de consentimiento autónomo por alumno del grupo (un día). */
  @Get('staff/group/:groupId')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  listForGroup(
    @Req() req: Request & { user: JwtUser },
    @Param('groupId', new ParseUUIDPipe({ version: '4' })) groupId: string,
    @Query('date') date?: string
  ) {
    return this.service.listAutonomousForGroup(req.user.userId, req.user.role, groupId, date);
  }
}
