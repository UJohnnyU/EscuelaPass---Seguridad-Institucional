import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
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
import { CreateNonInstructionalDayDto } from './dto/create-non-instructional-day.dto';
import { SchoolCalendarService } from './school-calendar.service';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('calendar')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchoolCalendarController {
  constructor(private readonly schoolCalendarService: SchoolCalendarService) {}

  @Get('me/student')
  @Roles(UserRole.ALUMNO)
  listNonInstructionalMine(
    @Req() req: Request & { user: JwtUser },
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined
  ) {
    return this.schoolCalendarService.listNonInstructionalForStudent(req.user.userId, from, to);
  }

  @Get('parent/my-children')
  @Roles(UserRole.PADRE)
  listNonInstructionalForChildren(
    @Req() req: Request & { user: JwtUser },
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined
  ) {
    return this.schoolCalendarService.listNonInstructionalForParent(req.user.userId, from, to);
  }

  @Get('non-instructional-days')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  list(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('groupId') groupId: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.schoolCalendarService.listForStaff(req.user, from, to, groupId);
  }

  @Post('non-instructional-days')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  create(@Body() dto: CreateNonInstructionalDayDto, @Req() req: Request & { user: JwtUser }) {
    return this.schoolCalendarService.create(dto, req.user.userId, req.user.role);
  }

  @Delete('non-instructional-days/:id')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.schoolCalendarService.remove(id, req.user.userId, req.user.role);
  }
}
