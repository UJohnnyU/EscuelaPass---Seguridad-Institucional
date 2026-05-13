import {
  BadRequestException,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { avatarMulterOptions, reportEvidenceMulterOptions, schoolLogoMulterOptions } from './image-multer.config';
import { UploadsService } from './uploads.service';

type JwtUser = { userId: string; email: string; role: UserRole };
const IMAGE_UPLOAD_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const EVIDENCE_UPLOAD_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('users/:userId/avatar')
  @Roles(UserRole.ADMIN, UserRole.ADMINISTRATIVO, UserRole.DOCENTE)
  @UseInterceptors(FileInterceptor('file', avatarMulterOptions))
  async uploadUserAvatar(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request & { user: JwtUser }
  ) {
    if (!file?.filename) {
      return { avatarUrl: null };
    }
    const valid = await this.uploadsService.validateUploadedFile(file, IMAGE_UPLOAD_MIMES);
    if (!valid) {
      throw new BadRequestException('Tipo de archivo invalido (firma no coincide).');
    }
    return this.uploadsService.setUserAvatar(req.user.userId, req.user.role, userId, file.filename);
  }

  @Post('schools/:schoolId/logo')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file', schoolLogoMulterOptions))
  async uploadSchoolLogo(
    @Param('schoolId', new ParseUUIDPipe({ version: '4' })) schoolId: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file?.filename) {
      return { logoUrl: null };
    }
    const valid = await this.uploadsService.validateUploadedFile(file, IMAGE_UPLOAD_MIMES);
    if (!valid) {
      throw new BadRequestException('Tipo de archivo invalido (firma no coincide).');
    }
    return this.uploadsService.setSchoolLogo(schoolId, file.filename);
  }

  // Lo usan TODOS los roles autenticados desde el widget "Reportar problema"
  // del AppShell y desde Operativos, asi que listamos los roles explicitamente
  // para no depender de "ausencia de @Roles" como mecanismo de autorizacion.
  @Post('reports/evidence')
  @Roles(
    UserRole.ADMIN,
    UserRole.ADMINISTRATIVO,
    UserRole.DOCENTE,
    UserRole.PADRE,
    UserRole.ALUMNO
  )
  @UseInterceptors(FileInterceptor('file', reportEvidenceMulterOptions))
  async uploadReportEvidence(@UploadedFile() file: Express.Multer.File) {
    if (!file?.filename) {
      return { evidenceUrl: null };
    }
    const valid = await this.uploadsService.validateUploadedFile(file, EVIDENCE_UPLOAD_MIMES);
    if (!valid) {
      throw new BadRequestException('Tipo de archivo invalido (firma no coincide).');
    }
    return this.uploadsService.uploadReportEvidence(file.filename);
  }
}
