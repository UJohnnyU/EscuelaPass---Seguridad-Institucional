/*
Escuela Pass — Proprietary Software License
Copyright (c) 2026 Murillo Martínez Jhon Kevin. All Rights Reserved.

NOTICE: This software and associated documentation files (the "Software")
constitute proprietary intellectual property. Unauthorized use is prohibited.

1. GRANT OF RIGHTS
   No license is granted to any person or entity except as expressly set
   forth in a separate written agreement signed by the copyright holder.

2. RESTRICTIONS
   Without prior written permission from the copyright holder, you may NOT:
   (a) copy, modify, adapt, translate, or create derivative works of the Software;
   (b) reverse engineer, decompile, or disassemble the Software, except as
       permitted by applicable law;
   (c) distribute, sublicense, lease, rent, sell, or otherwise transfer the
       Software or any portion thereof;
   (d) use the Software for commercial purposes, including offering it as a
       hosted service to third parties;
   (e) remove or alter any proprietary notices, labels, or marks.

3. THIRD-PARTY COMPONENTS
   The Software may include or depend on third-party open-source components
   licensed under their own terms (see package manifests and NOTICE files).
   Those components remain governed by their respective licenses. This license
   applies only to the original work of the copyright holder.

4. ACADEMIC REPOSITORY (POLI JIC)
   A non-exclusive, royalty-free, limited license is granted to Politécnico
   Colombiano Jaime Isaza Cadavid solely to archive, reproduce, and make
   available the version of the Software submitted as part of the author's
   degree thesis for academic, educational, and non-commercial public
   consultation purposes, in accordance with institutional publication
   authorization. This does not grant commercial exploitation rights to
   the institution or to third parties.

5. NO WARRANTY
   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL
   THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY.

6. GOVERNING LAW
   This license shall be governed by the laws of the Republic of Colombia,
   without regard to conflict-of-law principles.

7. CONTACT
   For licensing inquiries: jhonkevinmurillom@gmail.com

---

Resumen en español:
Software propietario de Murillo Martínez Jhon Kevin (2026). Queda prohibida la
copia, modificación, distribución o explotación comercial sin autorización
escrita. El POLI JIC cuenta con autorización limitada, no exclusiva y sin
fines de lucro, para archivo y consulta académica de la versión entregada
como Trabajo de Grado. Los componentes de terceros se rigen por sus propias
licencias.
*/

import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  Res,
  UseGuards
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ReportCardType } from '../../database/entities/report-card.entity';
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

  @Get('bulletins/bulk')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  async bulletinsBulkPdf(
    @Req() req: Request & { user: JwtUser },
    @Res() res: Response,
    @Query('schoolId') schoolId?: string,
    @Query('schoolYear') schoolYear?: string,
    @Query('periodId') periodId?: string,
    @Query('type') type?: string,
    @Query('studentId') studentId?: string,
    @Query('groupId') groupId?: string
  ) {
    const t = type === 'PERIOD' || type === 'FINAL' ? (type as ReportCardType) : null;
    const result = await this.documentsService.buildBulletinsBulkPdf(
      req.user.userId,
      req.user.role,
      {
        schoolId: schoolId?.trim() || null,
        schoolYear: schoolYear?.trim() || null,
        periodId: periodId?.trim() || null,
        type: t,
        studentId: studentId?.trim() || null,
        groupId: groupId?.trim() || null
      }
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('X-Bulletin-Count', String(result.count));
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.end(result.buffer);
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
