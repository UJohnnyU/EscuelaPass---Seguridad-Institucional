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
import { CancelExternalVisitDto } from './dto/cancel-external-visit.dto';
import { CreateExternalVisitDto } from './dto/create-external-visit.dto';
import { RescheduleExternalVisitDto } from './dto/reschedule-external-visit.dto';
import { UpdateExternalVisitDto } from './dto/update-external-visit.dto';
import { ExternalVisitsService } from './external-visits.service';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('external-visits')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExternalVisitsController {
  constructor(private readonly visitsService: ExternalVisitsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  create(@Body() dto: CreateExternalVisitDto, @Req() req: Request & { user: JwtUser }) {
    return this.visitsService.create(dto, req.user.userId, req.user.role);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  list(@Req() req: Request & { user: JwtUser }) {
    return this.visitsService.list({ userId: req.user.userId, role: req.user.role });
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
    return this.visitsService.listMine({ userId: req.user.userId, role: req.user.role });
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
    return this.visitsService.getDetail(id, req.user.userId, req.user.role);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateExternalVisitDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.visitsService.update(id, dto, req.user.userId, req.user.role);
  }

  @Post(':id/reschedule')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  reschedule(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: RescheduleExternalVisitDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.visitsService.reschedule(id, dto, req.user.userId, req.user.role);
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  cancel(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CancelExternalVisitDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.visitsService.cancel(id, dto.reason, req.user.userId, req.user.role);
  }

  @Post(':id/realized')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  markRealized(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.visitsService.markRealized(id, req.user.userId, req.user.role);
  }
}
