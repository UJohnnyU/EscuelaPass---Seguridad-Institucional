import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { openSync, readSync, closeSync, existsSync, unlinkSync } from 'fs';
import { filetypemime } from 'magic-bytes.js';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { uploadsSubDir } from '../../lib/uploads-path';

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_EVIDENCE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

function imageStorage(subfolder: 'avatars' | 'school-logos' | 'reports') {
  return diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadsSubDir(subfolder));
    },
    filename: (_req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase() || '.bin';
      const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf'].includes(ext) ? ext : '.jpg';
      cb(null, `${randomUUID()}${safeExt}`);
    }
  });
}

const imageFileFilter = (
  _req: unknown,
  file: { mimetype: string },
  cb: (e: Error | null, ok: boolean) => void
) => {
  if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) {
    cb(new BadRequestException('Use una imagen JPG, PNG, WEBP o GIF.'), false);
    return;
  }
  cb(null, true);
};

const evidenceFileFilter = (
  _req: unknown,
  file: { mimetype: string },
  cb: (e: Error | null, ok: boolean) => void
) => {
  if (!ALLOWED_EVIDENCE_MIME.has(file.mimetype)) {
    cb(new BadRequestException('Use JPG, PNG, WEBP o PDF.'), false);
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
  fileFilter: imageFileFilter
};

export const schoolLogoMulterOptions = {
  storage: imageStorage('school-logos'),
  limits,
  fileFilter: imageFileFilter
};

export const reportEvidenceMulterOptions = {
  storage: imageStorage('reports'),
  limits: {
    fileSize: Number(process.env.REPORT_IMAGE_MAX_BYTES ?? 5 * 1024 * 1024)
  },
  fileFilter: evidenceFileFilter
};

export async function validateUploadedFileSignature(
  filePath: string,
  allowedMimes: string[]
): Promise<boolean> {
  if (!existsSync(filePath)) return false;
  let fd: number | null = null;
  try {
    const header = Buffer.alloc(32);
    fd = openSync(filePath, 'r');
    const readBytes = readSync(fd, header, 0, 32, 0);
    const bytes = Array.from(header.subarray(0, readBytes));
    const detectedMimes = filetypemime(bytes);
    const isAllowed = detectedMimes.some((mime) => allowedMimes.includes(mime));
    if (!isAllowed) {
      unlinkSync(filePath);
      return false;
    }
    return true;
  } catch {
    try {
      unlinkSync(filePath);
    } catch {
      /* ignore cleanup errors */
    }
    return false;
  } finally {
    if (fd !== null) {
      closeSync(fd);
    }
  }
}
