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
