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
