import { Controller, ForbiddenException, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DashboardService } from './dashboard.service';

type JwtUser = { userId: string; email: string; role: UserRole; schoolId?: string | null };

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  summary(
    @Req() req: Request & { user: JwtUser },
    @Query('date') date: string | undefined,
    @Query('schoolId') schoolId: string | undefined
  ) {
    let sid = schoolId?.trim() || undefined;
    if (req.user.role === UserRole.ADMINISTRATIVO) {
      const mine = req.user.schoolId?.trim() || undefined;
      if (!mine) throw new ForbiddenException('Usuario sin escuela asignada');
      if (sid && sid !== mine) throw new ForbiddenException('No autorizado a consultar otra institución');
      sid = mine;
    }
    return this.dashboardService.summary(date, sid);
  }

  /** Panel con serie semanal de circuitos, desglose por grupo y KPIs operativos. */
  @Get('panel')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  panel(
    @Req() req: Request & { user: JwtUser },
    @Query('date') date: string | undefined,
    @Query('windowDays') windowDays: string | undefined,
    @Query('schoolId') schoolId: string | undefined
  ) {
    let scope: string | undefined;
    if (req.user.role === UserRole.ADMINISTRATIVO) {
      scope = req.user.schoolId?.trim() || undefined;
      if (!scope) throw new ForbiddenException('Usuario sin escuela asignada');
    } else {
      scope = schoolId?.trim() || undefined;
    }
    return this.dashboardService.adminPanel(date, windowDays, scope);
  }
}
