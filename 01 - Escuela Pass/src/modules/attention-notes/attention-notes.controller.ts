import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateAttentionNoteDto } from './dto/create-attention-note.dto';
import { AttentionNotesService } from './attention-notes.service';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('attention-notes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttentionNotesController {
  constructor(private readonly attentionNotesService: AttentionNotesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  create(@Body() dto: CreateAttentionNoteDto, @Req() req: Request & { user: JwtUser }) {
    return this.attentionNotesService.create(dto, req.user.userId, req.user.role);
  }

  @Get('parent/my-children')
  @Roles(UserRole.PADRE)
  listMyChildren(
    @Req() req: Request & { user: JwtUser },
    @Query('studentId') studentId: string | undefined
  ) {
    return this.attentionNotesService.listMyChildren(req.user.userId, studentId);
  }
}

