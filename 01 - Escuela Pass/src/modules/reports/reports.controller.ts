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

import { Controller, ForbiddenException, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CircuitStatus } from '../../database/entities/circuit-request.entity';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ReportsService } from './reports.service';

type JwtUser = { userId: string; email: string; role: UserRole; schoolId?: string | null };

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('attendance/today')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  attendanceToday(
    @Query('groupId') groupId: string,
    @Query('date') date: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.reportsService.attendanceToday(groupId, req.user.userId, req.user.role, date);
  }

  @Get('attendance/classes')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  classAttendance(
    @Query('groupId') groupId: string,
    @Query('date') date: string | undefined,
    @Req() req: Request & { user: JwtUser }
  ) {
    return this.reportsService.classAttendanceByGroup(groupId, req.user.userId, req.user.role, date);
  }

  @Get('payments/pending')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  paymentsPending(@Req() req: Request & { user: JwtUser }, @Query('schoolId') schoolId: string | undefined) {
    let sid = schoolId?.trim() || undefined;
    if (req.user.role === UserRole.ADMINISTRATIVO) {
      const mine = req.user.schoolId?.trim() || undefined;
      if (!mine) throw new ForbiddenException('Usuario sin escuela asignada');
      if (sid && sid !== mine) throw new ForbiddenException('No autorizado a consultar otra institución');
      sid = mine;
    }
    return this.reportsService.paymentsPending(sid);
  }

  @Get('circuit/today')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  circuitToday(
    @Req() req: Request & { user: JwtUser },
    @Query('status') status: CircuitStatus | undefined,
    @Query('date') date: string | undefined,
    @Query('schoolId') schoolId: string | undefined
  ) {
    let sid = schoolId?.trim() || undefined;
    if (req.user.role === UserRole.ADMINISTRATIVO) {
      const mine = req.user.schoolId?.trim() || undefined;
      if (!mine) throw new ForbiddenException('Usuario sin escuela asignada');
      if (sid && sid !== mine) throw new ForbiddenException('No autorizado a consultar otra institución');
      sid = mine;
    }
    return this.reportsService.circuitToday(status, date, sid);
  }

  /** RF8: Reporte de accesos por rango de fechas (conteo por día). */
  @Get('access/range')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  accessRange(
    @Req() req: Request & { user: JwtUser },
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('schoolId') schoolId: string | undefined
  ) {
    const today = new Date().toISOString().slice(0, 10);
    let sid = schoolId?.trim() || undefined;
    if (req.user.role === UserRole.ADMINISTRATIVO) {
      const mine = req.user.schoolId?.trim() || undefined;
      if (!mine) throw new ForbiddenException('Usuario sin escuela asignada');
      if (sid && sid !== mine) throw new ForbiddenException('No autorizado a consultar otra institución');
      sid = mine;
    }
    return this.reportsService.accessRange(sid, from ?? today, to ?? today);
  }

  /** RF8: Resumen financiero (cobros, pendientes, mora, tasa de cobro). */
  @Get('finance/summary')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  financeSummary(
    @Req() req: Request & { user: JwtUser },
    @Query('schoolId') schoolId: string | undefined
  ) {
    let sid = schoolId?.trim() || undefined;
    if (req.user.role === UserRole.ADMINISTRATIVO) {
      const mine = req.user.schoolId?.trim() || undefined;
      if (!mine) throw new ForbiddenException('Usuario sin escuela asignada');
      if (sid && sid !== mine) throw new ForbiddenException('No autorizado a consultar otra institución');
      sid = mine;
    }
    return this.reportsService.financeSummary(sid);
  }
}

