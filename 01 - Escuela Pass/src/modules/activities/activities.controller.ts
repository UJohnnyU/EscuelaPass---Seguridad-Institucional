import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { Request } from 'express';
import { ActivityStatus } from '../../database/entities/activity.entity';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { SaveActivityGradesDto } from './dto/save-activity-grade.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('activities')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  @Header('Cache-Control', 'no-store, must-revalidate')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  list(
    @Req() req: Request & { user: JwtUser },
    @Query('groupId') groupId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('periodId') periodId?: string,
    @Query('status') status?: string,
    @Query('schoolId') schoolId?: string
  ) {
    const normalizedStatus =
      status && (status === 'OPEN' || status === 'CLOSED')
        ? (status as ActivityStatus)
        : undefined;
    return this.activitiesService.list(req.user.userId, req.user.role, {
      groupId: groupId?.trim() || null,
      subjectId: subjectId?.trim() || null,
      periodId: periodId?.trim() || null,
      status: normalizedStatus ?? null,
      schoolId: schoolId?.trim() || null
    });
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  create(@Body() dto: CreateActivityDto, @Req() req: Request & { user: JwtUser }) {
    return this.activitiesService.create(dto, req.user.userId, req.user.role);
  }

  @Get('teacher/my-assignments')
  @Header('Cache-Control', 'no-store, must-revalidate')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  listTeacherAssignments(
    @Req() req: Request & { user: JwtUser },
    @Query('schoolId') schoolId?: string
  ) {
    const filter =
      req.user.role === UserRole.ADMIN && schoolId?.trim() ? schoolId.trim() : undefined;
    return this.activitiesService.listTeacherAssignments(req.user.userId, req.user.role, filter);
  }

  @Get('student/me')
  @Header('Cache-Control', 'no-store, must-revalidate')
  @Roles(UserRole.ALUMNO)
  listForStudent(
    @Req() req: Request & { user: JwtUser },
    @Query('periodId') periodId?: string
  ) {
    return this.activitiesService.listForStudentUser(req.user.userId, {
      periodId: periodId?.trim() || null
    });
  }

  @Get('parent/my-children')
  @Header('Cache-Control', 'no-store, must-revalidate')
  @Roles(UserRole.PADRE)
  listForParent(
    @Req() req: Request & { user: JwtUser },
    @Query('studentId') studentId?: string,
    @Query('periodId') periodId?: string
  ) {
    return this.activitiesService.listForParent(req.user.userId, {
      studentId: studentId?.trim() || null,
      periodId: periodId?.trim() || null
    });
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store, must-revalidate')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  getBoard(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.activitiesService.getBoard(id, req.user.userId, req.user.role);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateActivityDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.activitiesService.update(id, dto, req.user.userId, req.user.role);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.activitiesService.remove(id, req.user.userId, req.user.role);
  }

  @Post(':id/close')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  close(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.activitiesService.close(id, req.user.userId, req.user.role);
  }

  @Post(':id/reopen')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  reopen(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.activitiesService.reopen(id, req.user.userId, req.user.role);
  }

  @Post(':id/grades')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  saveGrades(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: SaveActivityGradesDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.activitiesService.saveGrades(id, dto, req.user.userId, req.user.role);
  }
}
