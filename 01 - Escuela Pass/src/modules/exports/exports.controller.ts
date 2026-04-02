import { Controller, Get, Header, ParseUUIDPipe, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ExportsService } from './exports.service';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('exports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Get('attendance.csv')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async attendanceCsv(
    @Query('groupId', new ParseUUIDPipe({ version: '4' })) groupId: string,
    @Query('date') date: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    const csv = await this.exportsService.exportAttendanceCsv(
      groupId,
      req.user.userId,
      req.user.role,
      date
    );
    return csv;
  }

  @Get('grades.csv')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async gradesCsv(
    @Query('groupId', new ParseUUIDPipe({ version: '4' })) groupId: string,
    @Query('period') period: string | undefined,
    @Query('subject') subject: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    const csv = await this.exportsService.exportGradesCsv(
      groupId,
      req.user.userId,
      req.user.role,
      period,
      subject
    );
    return csv;
  }
}
