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
import { CreateScheduleSlotDto } from './dto/create-schedule-slot.dto';
import { UpdateScheduleSlotDto } from './dto/update-schedule-slot.dto';
import { SchedulesService } from './schedules.service';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('schedules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  private parseSearchLimit(limitRaw: string | undefined): number | undefined {
    if (!limitRaw?.trim()) return undefined;
    const n = parseInt(limitRaw, 10);
    if (Number.isNaN(n)) return undefined;
    return Math.min(Math.max(n, 1), 100);
  }

  @Get('me/teacher')
  @Roles(UserRole.DOCENTE)
  listMySlotsAsTeacher(
    @Req() req: Request & { user: JwtUser },
    @Query('refDate') refDate: string | undefined
  ) {
    return this.schedulesService.listMySlotsAsTeacher(req.user.userId, refDate);
  }

  @Get('me/teacher/groups')
  @Roles(UserRole.DOCENTE, UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  listMyGroupsAsTeacher(
    @Req() req: Request & { user: JwtUser },
    @Query('q') q: string | undefined,
    @Query('limit') limitRaw: string | undefined
  ) {
    const opts = { q: q?.trim(), limit: this.parseSearchLimit(limitRaw) };
    return this.schedulesService.listMyGroupsAsTeacher(req.user.userId, req.user.role, opts);
  }

  @Get('me/student')
  @Roles(UserRole.ALUMNO)
  listMySlotsAsStudent(
    @Req() req: Request & { user: JwtUser },
    @Query('refDate') refDate: string | undefined
  ) {
    return this.schedulesService.listMySlotsAsStudent(req.user.userId, refDate);
  }

  @Get('parent/my-children')
  @Roles(UserRole.PADRE)
  listMyChildrenSlotsAsParent(@Req() req: Request & { user: JwtUser }) {
    return this.schedulesService.listMyChildrenSlotsAsParent(req.user.userId);
  }

  @Get('groups/:groupId')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE, UserRole.PADRE, UserRole.ALUMNO)
  listByGroup(
    @Param('groupId', new ParseUUIDPipe({ version: '4' })) groupId: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.schedulesService.listByGroup(groupId, req.user.userId, req.user.role);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  create(@Body() dto: CreateScheduleSlotDto) {
    return this.schedulesService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateScheduleSlotDto
  ) {
    return this.schedulesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.schedulesService.remove(id);
  }
}
