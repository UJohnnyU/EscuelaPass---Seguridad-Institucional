import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { uploadsSubDir } from '../../lib/uploads-path';

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

function imageStorage(subfolder: 'avatars' | 'school-logos') {
  return diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadsSubDir(subfolder));
    },
    filename: (_req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase() || '.bin';
      const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
      cb(null, `${randomUUID()}${safeExt}`);
    }
  });
}

const fileFilter = (
  _req: unknown,
  file: { mimetype: string },
  cb: (e: Error | null, ok: boolean) => void
) => {
  if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) {
    cb(new BadRequestException('Use una imagen JPG, PNG o WEBP.'), false);
    return;
  }
  cb(null, true);
};

const limits = {
  fileSize: Number(process.env.PROFILE_IMAGE_MAX_BYTES ?? 2 * 1024 * 1024)
};

export const avatarMulterOptions = {
  storage: imageStorage('avatars'),
  limits,
  fileFilter
};

export const schoolLogoMulterOptions = {
  storage: imageStorage('school-logos'),
  limits,
  fileFilter
};
