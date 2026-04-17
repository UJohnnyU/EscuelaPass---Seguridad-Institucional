import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  Res,
  UseGuards
} from '@nestjs/common';
import { Request, Response } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DocumentsService } from './documents.service';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get('bulletin/:reportCardId')
  @Roles(
    UserRole.ADMIN,
    UserRole.ADMINISTRATIVO,
    UserRole.DOCENTE,
    UserRole.PADRE,
    UserRole.ALUMNO
  )
  async bulletinPdf(
    @Param('reportCardId', new ParseUUIDPipe({ version: '4' })) reportCardId: string,
    @Req() req: Request & { user: JwtUser },
    @Res() res: Response
  ) {
    const buf = await this.documentsService.buildBulletinPdf(
      reportCardId,
      req.user.userId,
      req.user.role
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="boletin-${reportCardId}.pdf"`);
    res.end(buf);
  }

  @Get('schedule/group/:groupId')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE, UserRole.PADRE, UserRole.ALUMNO)
  async groupSchedulePdf(
    @Param('groupId', new ParseUUIDPipe({ version: '4' })) groupId: string,
    @Req() req: Request & { user: JwtUser },
    @Res() res: Response
  ) {
    const buf = await this.documentsService.buildGroupSchedulePdf(
      groupId,
      req.user.userId,
      req.user.role
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="horario-grupo-${groupId}.pdf"`);
    res.end(buf);
  }

  @Get('groups/summary')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  async groupsSummaryPdf(@Req() req: Request & { user: JwtUser }, @Res() res: Response) {
    const buf = await this.documentsService.buildGroupsSummaryPdf(req.user.userId, req.user.role);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="resumen-grupos.pdf"');
    res.end(buf);
  }
}
