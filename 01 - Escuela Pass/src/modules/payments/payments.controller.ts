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
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { PaymentStatus } from '../../database/entities/debt.entity';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateConceptDto } from './dto/create-concept.dto';
import { CreateDebtDto } from './dto/create-debt.dto';
import { RejectVoucherDto } from './dto/reject-voucher.dto';
import { ApplyArrangementDto } from './dto/apply-arrangement.dto';
import { UpdateConceptDto } from './dto/update-concept.dto';
import { UploadVoucherDto } from './dto/upload-voucher.dto';
import { voucherMulterOptions } from './multer-voucher.config';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('concepts')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE, UserRole.PADRE, UserRole.ALUMNO)
  listConcepts(
    @Query('includeInactive') includeInactive: string | undefined,
    @Req() req: import('express').Request & { user?: { schoolId?: string } }
  ) {
    const schoolId = req.user?.schoolId ?? null;
    return this.paymentsService.listConcepts(includeInactive === 'true', schoolId);
  }

  @Post('concepts')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  createConcept(@Body() dto: CreateConceptDto) {
    return this.paymentsService.createConcept(dto);
  }

  @Post('concepts/ensure-base')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  ensureBaseConcepts() {
    return this.paymentsService.ensureBaseConceptTemplates();
  }

  @Patch('concepts/:id')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  updateConcept(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateConceptDto
  ) {
    return this.paymentsService.updateConcept(id, dto);
  }

  @Delete('concepts/:id')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  deleteConcept(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.paymentsService.deleteConcept(id);
  }

  @Post('debts')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  createDebt(@Body() dto: CreateDebtDto, @Req() req: { user: { userId: string; role: UserRole } }) {
    return this.paymentsService.createDebt(dto, req.user.userId, req.user.role);
  }

  @Get('debts/pending-review')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  listPending(
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: { user: { userId: string; role: UserRole } }
  ) {
    const p = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
    const l = Math.min(100, Math.max(1, Number.parseInt(limit ?? '30', 10) || 30));
    return this.paymentsService.listPendingVerification(p, l, req.user.userId, req.user.role);
  }

  @Get('debts/mine')
  @Roles(UserRole.PADRE)
  listMine(@Req() req: { user: { userId: string } }) {
    return this.paymentsService.listMyDebtsAsParent(req.user.userId);
  }

  @Get('debts')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  listDebtsAdmin(
    @Query('status') status: string | undefined,
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: { user: { userId: string; role: UserRole } }
  ) {
    const st: PaymentStatus | undefined =
      status === 'PENDIENTE' ||
      status === 'PAGADO' ||
      status === 'VENCIDO' ||
      status === 'COMPROBANTE_RECHAZADO'
        ? (status as PaymentStatus)
        : undefined;
    const p = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
    const l = Math.min(100, Math.max(1, Number.parseInt(limit ?? '30', 10) || 30));
    return this.paymentsService.listDebtsForAdmin(st, p, l, req.user.userId, req.user.role);
  }

  @Get('debts/adjustments')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  listDebtAdjustments(
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('schoolId') schoolId: string | undefined,
    @Req() req: { user: { userId: string; role: UserRole } }
  ) {
    const p = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
    const l = Math.min(200, Math.max(1, Number.parseInt(limit ?? '50', 10) || 50));
    return this.paymentsService.listDebtAdjustments(p, l, req.user.userId, req.user.role, schoolId);
  }

  @Post('debts/policies/run')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  runDebtPolicies(@Req() req: { user: { userId: string; role: UserRole } }) {
    return this.paymentsService.runDebtPolicies(req.user.userId);
  }

  @Post('debts/:debtId/voucher')
  @Roles(UserRole.PADRE)
  uploadVoucher(
    @Param('debtId', new ParseUUIDPipe({ version: '4' })) debtId: string,
    @Req() req: { user: { userId: string } },
    @Body() dto: UploadVoucherDto
  ) {
    return this.paymentsService.uploadVoucher(debtId, req.user.userId, dto);
  }

  @Post('debts/:debtId/voucher/file')
  @Roles(UserRole.PADRE)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF o imagen (JPG, PNG, WEBP). Max ~5 MB.'
        }
      }
    }
  })
  @UseInterceptors(FileInterceptor('file', voucherMulterOptions))
  uploadVoucherFile(
    @Param('debtId', new ParseUUIDPipe({ version: '4' })) debtId: string,
    @UploadedFile() file: { filename: string } | undefined,
    @Req() req: { user: { userId: string } }
  ) {
    if (!file) {
      throw new BadRequestException('Envía un archivo en el campo "file" (multipart/form-data)');
    }
    const relativePath = `/uploads/comprobantes/${file.filename}`;
    return this.paymentsService.uploadVoucher(debtId, req.user.userId, {
      voucherPath: relativePath
    });
  }

  @Post('debts/:debtId/verify')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  verify(
    @Param('debtId', new ParseUUIDPipe({ version: '4' })) debtId: string,
    @Req() req: { user: { userId: string; role: UserRole } }
  ) {
    return this.paymentsService.verifyDebt(debtId, req.user.userId, req.user.role);
  }

  @Post('debts/:debtId/reject-voucher')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  rejectVoucher(
    @Param('debtId', new ParseUUIDPipe({ version: '4' })) debtId: string,
    @Body() dto: RejectVoucherDto,
    @Req() req: { user: { userId: string; role: UserRole } }
  ) {
    return this.paymentsService.rejectVoucher(debtId, req.user.userId, req.user.role, dto);
  }

  @Post('debts/:debtId/arrangement')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO)
  applyArrangement(
    @Param('debtId', new ParseUUIDPipe({ version: '4' })) debtId: string,
    @Body() dto: ApplyArrangementDto,
    @Req() req: { user: { userId: string; role: UserRole } }
  ) {
    return this.paymentsService.applyArrangement(debtId, req.user.userId, req.user.role, dto);
  }
}
