import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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

  @Get('me/teacher')
  @Roles(UserRole.DOCENTE)
  listMySlotsAsTeacher(@Req() req: Request & { user: JwtUser }) {
    return this.schedulesService.listMySlotsAsTeacher(req.user.userId);
  }

  @Get('me/teacher/groups')
  @Roles(UserRole.DOCENTE)
  listMyGroupsAsTeacher(@Req() req: Request & { user: JwtUser }) {
    return this.schedulesService.listMyGroupsAsTeacher(req.user.userId);
  }

  @Get('me/student')
  @Roles(UserRole.ALUMNO)
  listMySlotsAsStudent(@Req() req: Request & { user: JwtUser }) {
    return this.schedulesService.listMySlotsAsStudent(req.user.userId);
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
