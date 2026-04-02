import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp'
]);

export function voucherUploadDir(): string {
  const dir = join(process.cwd(), 'uploads', 'comprobantes');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export const voucherMulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, voucherUploadDir());
    },
    filename: (_req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase() || '.bin';
      const safeExt = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.bin';
      cb(null, `${randomUUID()}${safeExt}`);
    }
  }),
  limits: {
    fileSize: Number(process.env.VOUCHER_MAX_BYTES ?? 5 * 1024 * 1024)
  },
  fileFilter: (_req: unknown, file: { mimetype: string }, cb: (e: Error | null, ok: boolean) => void) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new BadRequestException('Formato no permitido. Use PDF, JPG, PNG o WEBP.'), false);
      return;
    }
    cb(null, true);
  }
};
