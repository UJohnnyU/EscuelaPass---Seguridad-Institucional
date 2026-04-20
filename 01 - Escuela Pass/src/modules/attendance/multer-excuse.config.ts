import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { uploadsSubDir } from '../../lib/uploads-path';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp'
]);

export function excuseUploadDir(): string {
  return uploadsSubDir('excuses');
}

export const excuseMulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, excuseUploadDir());
    },
    filename: (_req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase() || '.bin';
      const safeExt = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.bin';
      cb(null, `${randomUUID()}${safeExt}`);
    }
  }),
  limits: {
    fileSize: Number(process.env.EXCUSE_MAX_BYTES ?? 5 * 1024 * 1024)
  },
  fileFilter: (_req: unknown, file: { mimetype: string }, cb: (e: Error | null, ok: boolean) => void) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new BadRequestException('Formato no permitido. Use PDF, JPG, PNG o WEBP.'), false);
      return;
    }
    cb(null, true);
  }
};
