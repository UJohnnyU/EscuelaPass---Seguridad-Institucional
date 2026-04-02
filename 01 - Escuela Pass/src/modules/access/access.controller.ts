import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AccessService } from './access.service';
import { RegisterAccessEventDto } from './dto/register-access-event.dto';

@Controller('access-events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  @Post('scan')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  scan(@Body() payload: RegisterAccessEventDto) {
    return this.accessService.scanAccess(payload);
  }
}
