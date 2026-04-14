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

  @Get('non-instructional-days')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  list(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('groupId') groupId: string | undefined
  ) {
    return this.schoolCalendarService.list(from, to, groupId);
  }

  @Post('non-instructional-days')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  create(@Body() dto: CreateNonInstructionalDayDto, @Req() req: Request & { user: JwtUser }) {
    return this.schoolCalendarService.create(dto, req.user.userId);
  }

  @Delete('non-instructional-days/:id')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.schoolCalendarService.remove(id);
  }
}
