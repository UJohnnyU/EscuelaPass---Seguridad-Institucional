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
  Get,
  Header,
  NotFoundException,
  Param,
  Req,
  Res,
  UseGuards
} from '@nestjs/common';
import { Request, Response } from 'express';
import { existsSync } from 'fs';
import { basename, resolve, sep } from 'path';
import { UserRole } from '../../database/entities/user.entity';
import { uploadsRootDir, uploadsSubDir } from '../../lib/uploads-path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FilesService, type PrivateFileBucket } from './files.service';

type JwtUser = { userId: string; email: string; role: UserRole };

const FILE_BUCKETS: ReadonlySet<PrivateFileBucket> = new Set([
  'avatars',
  'comprobantes',
  'excuses',
  'reports'
]);
const SAFE_FILENAME = /^[a-zA-Z0-9._-]+$/;
const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf'
};

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get(':bucket/:filename')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async getPrivateFile(
    @Param('bucket') bucketParam: string,
    @Param('filename') filenameParam: string,
    @Req() req: Request & { user: JwtUser },
    @Res() res: Response
  ) {
    if (!FILE_BUCKETS.has(bucketParam as PrivateFileBucket)) {
      throw new BadRequestException('Bucket invalido');
    }
    if (!SAFE_FILENAME.test(filenameParam)) {
      throw new BadRequestException('Nombre de archivo invalido');
    }
    const filename = basename(filenameParam);
    const bucket = bucketParam as PrivateFileBucket;
    const bucketDir = resolve(uploadsSubDir(bucket));
    const absPath = resolve(bucketDir, filename);
    if (absPath !== bucketDir && !absPath.startsWith(`${bucketDir}${sep}`)) {
      throw new BadRequestException('Ruta de archivo invalida');
    }
    let finalPath = absPath;
    if (!existsSync(finalPath) && bucket === 'reports') {
      const legacyPath = resolve(uploadsRootDir(), 'report-evidence', filename);
      if (legacyPath.startsWith(`${resolve(uploadsRootDir())}${sep}`) && existsSync(legacyPath)) {
        finalPath = legacyPath;
      }
    }
    if (!existsSync(finalPath)) {
      throw new NotFoundException('Archivo no encontrado');
    }

    await this.filesService.assertCanRead(req.user.userId, req.user.role, bucket, filename);

    const lower = filename.toLowerCase();
    const ext = lower.slice(lower.lastIndexOf('.'));
    const contentType = CONTENT_TYPES[ext];
    if (!contentType) {
      throw new BadRequestException('Extension no permitida');
    }
    res.type(contentType);
    return res.sendFile(finalPath);
  }
}
