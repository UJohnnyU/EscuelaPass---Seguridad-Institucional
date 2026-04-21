import { Controller, ForbiddenException, Get, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { DashboardService } from './dashboard.service';

type JwtUser = { userId: string; role: UserRole };

@Controller('dashboards')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardsController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Agregado de bloques para la pantalla de inicio por rol (documentado en el plan de rediseño).
   * El parámetro :role debe coincidir con el rol del JWT (excepto ADMIN de plataforma, que puede pedir cualquier rol).
   */
  @Get('home/:role')
  home(@Param('role') roleParam: string, @Req() req: Request & { user: JwtUser }) {
    const allowed = Object.values(UserRole) as string[];
    if (!allowed.includes(roleParam)) {
      throw new ForbiddenException('Rol inválido');
    }
    const role = roleParam as UserRole;
    if (req.user.role !== UserRole.ADMIN && req.user.role !== role) {
      throw new ForbiddenException('El rol solicitado no coincide con su sesión');
    }
    return this.dashboardService.getHomeForRole(req.user.userId, role);
  }
}
