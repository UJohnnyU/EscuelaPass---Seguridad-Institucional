import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CircuitService } from './circuit.service';
import { CreateCircuitRequestDto } from './dto/create-circuit-request.dto';
import { UpdateCircuitStatusDto } from './dto/update-circuit-status.dto';

type JwtUser = { userId: string; email: string; role: UserRole };

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

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE, UserRole.PADRE)
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.circuitService.findById(id);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  updateStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateCircuitStatusDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.circuitService.updateStatus(id, dto, req.user.userId, req.user.role);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.PADRE)
  cancel(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Req() req: Request & { user: JwtUser }) {
    return this.circuitService.cancel(id, req.user.userId);
  }
}
