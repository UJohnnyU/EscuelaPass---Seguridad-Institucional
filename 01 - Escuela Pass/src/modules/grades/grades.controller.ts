import { Controller, Get, Param, ParseUUIDPipe, Post, Body, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { RegisterGradeDto } from './dto/register-grade.dto';
import { GradesService } from './grades.service';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('grades')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @Post('register')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  register(@Body() dto: RegisterGradeDto, @Req() req: Request & { user: JwtUser }) {
    return this.gradesService.register(dto, req.user.userId, req.user.role);
  }

  @Get('student/:studentId')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE, UserRole.PADRE)
  listByStudent(
    @Param('studentId', new ParseUUIDPipe({ version: '4' })) studentId: string,
    @Query('period') period: string | undefined,
    @Query('subject') subject: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.gradesService.listByStudent(studentId, req.user.userId, req.user.role, period, subject);
  }

  @Get('groups/:groupId')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  listByGroup(
    @Param('groupId', new ParseUUIDPipe({ version: '4' })) groupId: string,
    @Query('period') period: string | undefined,
    @Query('subject') subject: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.gradesService.listByGroup(groupId, req.user.userId, req.user.role, period, subject);
  }

  @Get('parent/my-children')
  @Roles(UserRole.PADRE)
  listMyChildren(
    @Query('period') period: string | undefined,
    @Query('subject') subject: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.gradesService.listMyChildrenGrades(req.user.userId, period, subject);
  }
}