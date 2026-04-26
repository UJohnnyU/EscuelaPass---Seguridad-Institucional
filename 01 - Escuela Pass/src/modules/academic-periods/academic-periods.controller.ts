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
import { AcademicPeriodStatus } from '../../database/entities/academic-period.entity';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AcademicPeriodsService } from './academic-periods.service';
import { CreateAcademicPeriodDto } from './dto/create-academic-period.dto';
import { UpdateAcademicPeriodDto } from './dto/update-academic-period.dto';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('academic-periods')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AcademicPeriodsController {
  constructor(private readonly service: AcademicPeriodsService) {}

  @Get()
  @Header('Cache-Control', 'no-store, must-revalidate')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE, UserRole.PADRE, UserRole.ALUMNO)
  list(
    @Req() req: Request & { user: JwtUser },
    @Query('schoolId') schoolId?: string,
    @Query('schoolYear') schoolYear?: string,
    @Query('status') status?: string
  ) {
    const normalizedStatus =
      status === 'PLANNED' || status === 'ACTIVE' || status === 'CLOSED'
        ? (status as AcademicPeriodStatus)
        : undefined;
    if (
      req.user.role === UserRole.DOCENTE ||
      req.user.role === UserRole.PADRE ||
      req.user.role === UserRole.ALUMNO
    ) {
      return this.service.listForRoleVisible(req.user.userId, req.user.role, schoolYear);
    }
    return this.service.list(req.user.userId, req.user.role, {
      schoolId: schoolId || undefined,
      schoolYear: schoolYear || undefined,
      status: normalizedStatus
    });
  }

  @Get('policy/effective')
  @Header('Cache-Control', 'no-store, must-revalidate')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  effectivePolicy(
    @Req() req: Request & { user: JwtUser },
    @Query('schoolId') schoolId?: string,
    @Query('schoolYear') schoolYear?: string
  ) {
    return this.service.getEffectivePolicy(req.user.userId, req.user.role, {
      schoolId: schoolId || undefined,
      schoolYear: schoolYear || undefined
    });
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  create(@Body() dto: CreateAcademicPeriodDto, @Req() req: Request & { user: JwtUser }) {
    return this.service.create(dto, req.user.userId, req.user.role);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store, must-revalidate')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  get(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.service.get(id, req.user.userId, req.user.role);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateAcademicPeriodDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.service.update(id, dto, req.user.userId, req.user.role);
  }

  @Post(':id/activate')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  activate(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.service.activate(id, req.user.userId, req.user.role);
  }

  @Post(':id/close')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  close(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.service.close(id, req.user.userId, req.user.role);
  }

  @Post(':id/reopen')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  reopen(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.service.reopen(id, req.user.userId, req.user.role);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.service.delete(id, req.user.userId, req.user.role);
  }
}
