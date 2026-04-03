import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '../../database/entities/user.entity';import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UpdateCircuitSettingDto } from './dto/update-circuit-setting.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('circuit')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE, UserRole.PADRE, UserRole.ALUMNO)
  getCircuit() {
    return this.settingsService.getCircuitSetting();
  }

  @Patch('circuit')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  updateCircuit(@Body() dto: UpdateCircuitSettingDto) {
    return this.settingsService.setCircuitEnabled(dto.enabled);
  }
}
