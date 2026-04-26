import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { NoticesService } from './notices.service';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('notices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  create(
    @Body() dto: CreateNoticeDto,
    @Req() req: Request & { user: JwtUser },
    @Query('schoolId') schoolId?: string
  ) {
    return this.noticesService.create(dto, req.user.userId, req.user.role, schoolId);
  }

  @Get('teacher/groups')
  @Roles(UserRole.DOCENTE)
  teacherGroups(@Req() req: Request & { user: JwtUser }) {
    return this.noticesService.listTeacherGroupsForNotices(req.user.userId);
  }

  @Get('teacher/target-users')
  @Roles(UserRole.DOCENTE)
  teacherTargetUsers(@Req() req: Request & { user: JwtUser }, @Query('q') q?: string) {
    return this.noticesService.searchNoticeTargetsForTeacher(req.user.userId, q);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  list(
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('schoolId') schoolId: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    const p = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
    const l = Math.min(100, Math.max(1, Number.parseInt(limit ?? '20', 10) || 20));
    return this.noticesService.list(p, l, req.user.userId, req.user.role, schoolId?.trim() || undefined);
  }

  @Get('critical/read-receipts')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  criticalReadReceipts(
    @Req() req: Request & { user: JwtUser },
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('schoolId') schoolId: string | undefined
  ) {
    const p = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
    const l = Math.min(100, Math.max(1, Number.parseInt(limit ?? '20', 10) || 20));
    return this.noticesService.listCriticalNoticeReadReceipts(req.user.userId, req.user.role, {
      page: p,
      limit: l,
      schoolId: schoolId?.trim() || undefined
    });
  }
}
