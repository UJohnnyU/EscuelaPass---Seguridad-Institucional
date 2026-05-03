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
import { CreatePickupRequestDto } from './dto/create-pickup-request.dto';
import { UpdatePickupRequestStatusDto } from './dto/update-pickup-request-status.dto';
import { PickupRequestsService } from './pickup-requests.service';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('pickup-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PickupRequestsController {
  constructor(private readonly pickupRequestsService: PickupRequestsService) {}

  @Post()
  @Roles(UserRole.PADRE)
  create(@Body() dto: CreatePickupRequestDto, @Req() req: Request & { user: JwtUser }) {
    return this.pickupRequestsService.create(dto, req.user.userId);
  }

  @Get('me')
  @Roles(UserRole.PADRE)
  listMine(@Req() req: Request & { user: JwtUser }) {
    return this.pickupRequestsService.listMine(req.user.userId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  listForStaff(@Req() req: Request & { user: JwtUser }) {
    return this.pickupRequestsService.listForStaff(req.user.userId, req.user.role);
  }

  @Post(':id/cancel')
  @Roles(UserRole.PADRE)
  cancel(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.pickupRequestsService.cancelByParent(id, req.user.userId);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  updateStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdatePickupRequestStatusDto,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.pickupRequestsService.updateStatus(id, dto, req.user.userId, req.user.role);
  }
}
