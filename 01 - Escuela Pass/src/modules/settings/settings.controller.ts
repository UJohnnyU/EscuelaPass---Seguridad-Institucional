import { Body, Controller, Get, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UpdateCircuitSettingDto } from './dto/update-circuit-setting.dto';
import { UpdateInstitutionProfileDto } from './dto/update-institution-profile.dto';
import { SettingsService } from './settings.service';

type JwtUser = { userId: string; email: string; role: UserRole; schoolId?: string | null };

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('institution')
  @Roles(
    UserRole.ADMIN,
    UserRole.ADMINISTRATIVO,
    UserRole.DOCENTE,
    UserRole.PADRE,
    UserRole.ALUMNO
  )
  getInstitution(
    @Req() req: Request & { user: JwtUser },
    @Query('schoolId') schoolId: string | undefined
  ) {
    return this.settingsService.getInstitutionProfile(
      { role: req.user.role, schoolId: req.user.schoolId },
      schoolId
    );
  }

  @Patch('institution')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  updateInstitution(
    @Req() req: Request & { user: JwtUser },
    @Query('schoolId') schoolId: string | undefined,
    @Body() dto: UpdateInstitutionProfileDto
  ) {
    return this.settingsService.setInstitutionProfile({ role: req.user.role, schoolId: req.user.schoolId }, dto, schoolId);
  }

  @Get('circuit')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE, UserRole.PADRE, UserRole.ALUMNO)
  getCircuit(
    @Req() req: Request & { user: JwtUser },
    @Query('schoolId') schoolId: string | undefined
  ) {
    return this.settingsService.getCircuitSetting({ role: req.user.role, schoolId: req.user.schoolId }, schoolId);
  }

  @Patch('circuit')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  updateCircuit(
    @Req() req: Request & { user: JwtUser },
    @Query('schoolId') schoolId: string | undefined,
    @Body() dto: UpdateCircuitSettingDto
  ) {
    return this.settingsService.setCircuitEnabled(
      { role: req.user.role, schoolId: req.user.schoolId },
      dto.enabled,
      schoolId
    );
  }
}
