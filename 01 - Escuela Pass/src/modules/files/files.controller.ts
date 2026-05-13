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
