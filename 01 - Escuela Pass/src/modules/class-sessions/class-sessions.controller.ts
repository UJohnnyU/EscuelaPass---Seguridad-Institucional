import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ClassSessionsService } from './class-sessions.service';
import { CreateClassSessionDto } from './dto/create-class-session.dto';
import { UpdateClassSessionDto } from './dto/update-class-session.dto';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('class-sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassSessionsController {
  constructor(private readonly classSessionsService: ClassSessionsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  list(
    @Req() req: Request & { user: JwtUser },
    @Query('schoolId') schoolId: string | undefined,
    @Query('academicPeriodId') academicPeriodId: string | undefined,
    @Query('groupId') groupId: string | undefined,
    @Query('teacherId') teacherId: string | undefined,
    @Query('subjectId') subjectId: string | undefined,
    @Query('weekday') weekdayRaw: string | undefined,
    @Query('activeOnly') activeOnlyRaw: string | undefined
  ) {
    const weekday = weekdayRaw !== undefined ? Number.parseInt(weekdayRaw, 10) : undefined;
    const activeOnly =
      activeOnlyRaw === undefined ? undefined : ['1', 'true', 'yes', 'si'].includes(activeOnlyRaw.toLowerCase());
    return this.classSessionsService.list(req.user.userId, req.user.role, {
      schoolId,
      academicPeriodId,
      groupId,
      teacherId,
      subjectId,
      weekday: Number.isNaN(weekday) ? undefined : weekday,
      activeOnly
    });
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  create(@Req() req: Request & { user: JwtUser }, @Body() dto: CreateClassSessionDto) {
    return this.classSessionsService.create(req.user.userId, req.user.role, dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  update(
    @Req() req: Request & { user: JwtUser },
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateClassSessionDto
  ) {
    return this.classSessionsService.update(req.user.userId, req.user.role, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  remove(
    @Req() req: Request & { user: JwtUser },
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string
  ) {
    return this.classSessionsService.remove(req.user.userId, req.user.role, id);
  }
}
