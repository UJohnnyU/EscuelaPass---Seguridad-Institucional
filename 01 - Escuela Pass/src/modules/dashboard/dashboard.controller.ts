import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  summary(@Query('date') date: string | undefined) {
    return this.dashboardService.summary(date);
  }

  /** Panel con serie semanal de circuitos, desglose por grupo y KPIs operativos. */
  @Get('panel')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  panel(@Query('date') date: string | undefined) {
    return this.dashboardService.adminPanel(date);
  }
}
