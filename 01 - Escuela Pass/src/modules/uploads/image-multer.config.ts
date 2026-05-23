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
