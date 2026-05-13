import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ClassAttendanceService } from './class-attendance.service';
import { RegisterBulkClassAttendanceDto } from './dto/register-bulk-class-attendance.dto';
import { RegisterClassAttendanceDto } from './dto/register-class-attendance.dto';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('class-attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassAttendanceController {
  constructor(private readonly classAttendanceService: ClassAttendanceService) {}

  @Post('register')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  register(@Body() dto: RegisterClassAttendanceDto, @Req() req: Request & { user: JwtUser }) {
    return this.classAttendanceService.register(dto, req.user.userId, req.user.role);
  }

  @Post('bulk')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  registerBulk(@Body() dto: RegisterBulkClassAttendanceDto, @Req() req: Request & { user: JwtUser }) {
    return this.classAttendanceService.registerBulk(dto, req.user.userId, req.user.role);
  }

  @Get('class/:classSessionId')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  listByClass(
    @Param('classSessionId', new ParseUUIDPipe({ version: '4' })) classSessionId: string,
    @Query('date') date: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.classAttendanceService.listByClass(classSessionId, date, req.user.userId, req.user.role);
  }

  @Get('parent/me')
  @Roles(UserRole.PADRE)
  listForParentChildren(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.classAttendanceService.listForParentChildren(req.user.userId, { from, to });
  }

  @Get('student/:studentId')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE, UserRole.PADRE)
  listByStudent(
    @Param('studentId', new ParseUUIDPipe({ version: '4' })) studentId: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.classAttendanceService.listByStudent(
      studentId,
      { from, to },
      req.user.userId,
      req.user.role
    );
  }
}
