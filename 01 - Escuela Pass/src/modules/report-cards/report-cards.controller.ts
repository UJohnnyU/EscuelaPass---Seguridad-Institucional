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
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { Request } from 'express';
import { ReportCardType } from '../../database/entities/report-card.entity';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ReportCardsService } from './report-cards.service';

type JwtUser = { userId: string; email: string; role: UserRole };

@Controller('report-cards')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportCardsController {
  constructor(private readonly service: ReportCardsService) {}

  @Get()
  @Header('Cache-Control', 'no-store, must-revalidate')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  list(
    @Req() req: Request & { user: JwtUser },
    @Query('schoolId') schoolId?: string,
    @Query('schoolYear') schoolYear?: string,
    @Query('periodId') periodId?: string,
    @Query('type') type?: string,
    @Query('studentId') studentId?: string
  ) {
    const t = type === 'PERIOD' || type === 'FINAL' ? (type as ReportCardType) : undefined;
    return this.service.listForAdmin(req.user.userId, req.user.role, {
      schoolId: schoolId || undefined,
      schoolYear: schoolYear || undefined,
      periodId: periodId || undefined,
      type: t,
      studentId: studentId || undefined
    });
  }

  @Get('student/me')
  @Header('Cache-Control', 'no-store, must-revalidate')
  @Roles(UserRole.ALUMNO)
  listForStudent(@Req() req: Request & { user: JwtUser }) {
    return this.service.listForStudentUser(req.user.userId);
  }

  /** Alias corto: debe declararse antes de `:id` para no caer en ParseUUIDPipe('me'). */
  @Get('me')
  @Header('Cache-Control', 'no-store, must-revalidate')
  @Roles(UserRole.ALUMNO)
  listForStudentMeAlias(@Req() req: Request & { user: JwtUser }) {
    return this.service.listForStudentUser(req.user.userId);
  }

  @Get('parent/my-children')
  @Header('Cache-Control', 'no-store, must-revalidate')
  @Roles(UserRole.PADRE)
  listForParent(
    @Req() req: Request & { user: JwtUser },
    @Query('studentId') studentId?: string
  ) {
    return this.service.listForParentUser(req.user.userId, studentId?.trim() || undefined);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store, must-revalidate')
  @Roles(
    UserRole.ADMIN,
    UserRole.ADMINISTRATIVO,
    UserRole.DOCENTE,
    UserRole.PADRE,
    UserRole.ALUMNO
  )
  detail(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.service.getDetail(id, req.user.userId, req.user.role);
  }

  @Post('generate-period/:periodId')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  regeneratePeriod(
    @Param('periodId', new ParseUUIDPipe({ version: '4' })) periodId: string,
    @Body() body: { publish?: boolean } | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.service.regenerateForPeriodByAdmin(
      periodId,
      req.user.userId,
      req.user.role,
      body?.publish ?? true
    );
  }

  @Post('generate-final')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  regenerateFinal(
    @Body() body: { schoolId: string; schoolYear: string; publish?: boolean },
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.service.regenerateFinalByAdmin(
      body.schoolId,
      body.schoolYear,
      req.user.userId,
      req.user.role,
      body.publish ?? true
    );
  }
}
