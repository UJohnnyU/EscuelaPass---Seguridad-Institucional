import {
  Controller,
  Get,
  ParseUUIDPipe,
  Query,
  Req,
  StreamableFile,
  UseGuards
} from '@nestjs/common';
import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
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

  @Get('attendance.xlsx')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  async attendanceXlsx(
    @Query('groupId', new ParseUUIDPipe({ version: '4' })) groupId: string,
    @Query('date') date: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    const { filePath, filename } = await this.exportsService.exportAttendanceXlsx(
      groupId,
      req.user.userId,
      req.user.role,
      date
    );
    const stream = createReadStream(filePath);
    const cleanup = () => {
      void fs.unlink(filePath).catch(() => undefined);
    };
    stream.on('close', cleanup);
    stream.on('error', cleanup);
    return new StreamableFile(stream, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${filename}"`
    });
  }

  @Get('class-attendance.xlsx')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  async classAttendanceXlsx(
    @Query('groupId', new ParseUUIDPipe({ version: '4' })) groupId: string,
    @Query('date') date: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    const { buffer, filename } = await this.exportsService.exportClassAttendanceXlsx(
      groupId,
      req.user.userId,
      req.user.role,
      date
    );
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${filename}"`
    });
  }

  @Get('grades.xlsx')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  async gradesXlsx(
    @Query('groupId', new ParseUUIDPipe({ version: '4' })) groupId: string,
    @Query('period') period: string | undefined,
    @Query('subject') subject: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    const { buffer, filename } = await this.exportsService.exportGradesXlsx(
      groupId,
      req.user.userId,
      req.user.role,
      period,
      subject
    );
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${filename}"`
    });
  }

  @Get('bulletin-consolidated.xlsx')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  async bulletinConsolidatedXlsx(
    @Query('groupId', new ParseUUIDPipe({ version: '4' })) groupId: string,
    @Query('period') period: string | undefined,
    @Query('subject') subject: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    const { buffer, filename } = await this.exportsService.exportBulletinConsolidatedXlsx(
      groupId,
      req.user.userId,
      req.user.role,
      period,
      subject
    );
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${filename}"`
    });
  }
}
