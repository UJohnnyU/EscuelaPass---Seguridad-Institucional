import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CircuitService } from './circuit.service';
import { CreateCircuitRequestDto } from './dto/create-circuit-request.dto';

@Controller('circuit-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CircuitController {
  constructor(private readonly circuitService: CircuitService) {}

  @Post()
  @Roles(UserRole.PADRE, UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  create(@Body() payload: CreateCircuitRequestDto) {
    return this.circuitService.create(payload);
  }

  @Get('today')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  findToday() {
    return this.circuitService.findToday();
  }
}
