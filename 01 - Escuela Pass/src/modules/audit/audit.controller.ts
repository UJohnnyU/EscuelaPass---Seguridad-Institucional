import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @Roles(UserRole.ADMIN)
  listLogs(@Query('limit') limit: string | undefined) {
    const parsed = Number.parseInt(limit ?? '50', 10);
    return this.auditService.listRecent(Number.isNaN(parsed) ? 50 : parsed);
  }
}
