import {
  Body,
  Controller,
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
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingStatusDto } from './dto/update-meeting-status.dto';
import { MeetingsService } from './meetings.service';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('meetings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Post()
  @Roles(UserRole.PADRE)
  create(@Body() dto: CreateMeetingDto, @Req() req: Request & { user: JwtUser }) {
    return this.meetingsService.create(dto, req.user.userId);
  }

  @Get('me')
  @Roles(UserRole.PADRE)
  listMine(@Req() req: Request & { user: JwtUser }) {
    return this.meetingsService.listMine(req.user.userId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  listForStaff(@Req() req: Request & { user: JwtUser }) {
    return this.meetingsService.listForStaff(req.user.userId, req.user.role);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  updateStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateMeetingStatusDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.meetingsService.updateStatus(id, dto, req.user.userId, req.user.role);
  }
}
