import { Controller, ForbiddenException, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CircuitStatus } from '../../database/entities/circuit-request.entity';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ReportsService } from './reports.service';

type JwtUser = { userId: string; email: string; role: UserRole; schoolId?: string | null };

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('attendance/today')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  attendanceToday(
    @Query('groupId') groupId: string,
    @Query('date') date: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.reportsService.attendanceToday(groupId, req.user.userId, req.user.role, date);
  }

  @Get('payments/pending')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  paymentsPending(@Req() req: Request & { user: JwtUser }, @Query('schoolId') schoolId: string | undefined) {
    let sid = schoolId?.trim() || undefined;
    if (req.user.role === UserRole.ADMINISTRATIVO) {
      const mine = req.user.schoolId?.trim() || undefined;
      if (!mine) throw new ForbiddenException('Usuario sin escuela asignada');
      if (sid && sid !== mine) throw new ForbiddenException('No autorizado a consultar otra institución');
      sid = mine;
    }
    return this.reportsService.paymentsPending(sid);
  }

  @Get('circuit/today')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  circuitToday(
    @Req() req: Request & { user: JwtUser },
    @Query('status') status: CircuitStatus | undefined,
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
    return this.reportsService.circuitToday(status, date, sid);
  }
}

