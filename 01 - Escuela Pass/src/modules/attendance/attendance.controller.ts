import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AttendanceService } from './attendance.service';
import { RegisterAttendanceDto } from './dto/register-attendance.dto';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('register')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  register(@Body() dto: RegisterAttendanceDto, @Req() req: Request & { user: JwtUser }) {
    return this.attendanceService.register(dto, req.user.userId, req.user.role);
  }

  @Get('groups/:groupId')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  listByGroup(
    @Param('groupId', new ParseUUIDPipe({ version: '4' })) groupId: string,
    @Query('date') date: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.attendanceService.listByGroup(groupId, date, req.user.userId, req.user.role);
  }

  @Get('parent/my-children')
  @Roles(UserRole.PADRE)
  listParent(@Query('date') date: string | undefined, @Req() req: Request & { user: JwtUser }) {
    return this.attendanceService.listMyChildrenAttendance(req.user.userId, date);
  }

  @Get('parent/my-students')
  @Roles(UserRole.PADRE)
  listMyStudents(@Req() req: Request & { user: JwtUser }) {
    return this.attendanceService.listMyStudentsForParent(req.user.userId);
  }
}
