import {
  Body,
  Controller,
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
import { CancelMeetingDto } from './dto/cancel-meeting.dto';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { MeetingRsvpDto } from './dto/meeting-rsvp.dto';
import { MeetingStatusDto } from './dto/meeting-status.dto';
import { RescheduleMeetingDto } from './dto/reschedule-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { MeetingsService } from './meetings.service';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('meetings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  create(
    @Body() dto: CreateMeetingDto,
    @Req() req: Request & { user: JwtUser },
    @Query('schoolId') schoolId?: string
  ) {
    return this.meetingsService.create(dto, req.user.userId, req.user.role, schoolId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  list(@Req() req: Request & { user: JwtUser }, @Query('schoolId') schoolId?: string) {
    return this.meetingsService.listForStaff({ userId: req.user.userId, role: req.user.role }, schoolId);
  }

  @Get('me')
  @Roles(
    UserRole.PADRE,
    UserRole.ALUMNO,
    UserRole.DOCENTE,
    UserRole.ADMINISTRATIVO,
    UserRole.ADMIN
  )
  listMine(@Req() req: Request & { user: JwtUser }) {
    return this.meetingsService.listMine(req.user.userId);
  }

  @Get(':id')
  @Roles(
    UserRole.PADRE,
    UserRole.ALUMNO,
    UserRole.DOCENTE,
    UserRole.ADMINISTRATIVO,
    UserRole.ADMIN
  )
  detail(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.meetingsService.getDetail(id, req.user.userId, req.user.role);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateMeetingDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.meetingsService.update(id, dto, req.user.userId, req.user.role);
  }

  @Post(':id/reschedule')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  reschedule(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: RescheduleMeetingDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.meetingsService.reschedule(id, dto, req.user.userId, req.user.role);
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  cancel(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CancelMeetingDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.meetingsService.cancel(id, dto, req.user.userId, req.user.role);
  }

  @Post(':id/status')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  status(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: MeetingStatusDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.meetingsService.changeStatus(id, dto, req.user.userId, req.user.role);
  }

  @Post(':id/rsvp')
  @Roles(
    UserRole.PADRE,
    UserRole.ALUMNO,
    UserRole.DOCENTE,
    UserRole.ADMINISTRATIVO,
    UserRole.ADMIN
  )
  rsvp(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: MeetingRsvpDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.meetingsService.rsvp(id, dto, req.user.userId, req.user.role);
  }
}
