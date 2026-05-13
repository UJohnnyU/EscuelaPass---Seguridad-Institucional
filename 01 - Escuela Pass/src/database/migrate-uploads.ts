import { Logger } from '@nestjs/common';
import { existsSync, promises as fs } from 'fs';
import { join } from 'path';

/**
 * Si `UPLOADS_DIR` apunta a un Volume persistente pero existe una carpeta
 * legacy `./uploads` con archivos del despliegue anterior, los copia al Volume.
 * Es idempotente: si el Volume ya tiene archivos con el mismo nombre no los
 * sobrescribe.
 */
export async function migrateUploadsToVolume(targetRoot: string): Promise<void> {
  const logger = new Logger('migrateUploadsToVolume');
  const legacyRoot = join(process.cwd(), 'uploads');
  if (!process.env.UPLOADS_DIR || !process.env.UPLOADS_DIR.trim()) return;
  if (!existsSync(legacyRoot)) return;
  if (legacyRoot === targetRoot) return;

  const subdirs = ['comprobantes', 'avatars', 'school-logos', 'excuses', 'reports', 'report-evidence'];
  let copied = 0;
  for (const sub of subdirs) {
    const src = join(legacyRoot, sub);
    if (!existsSync(src)) continue;
    const dst = join(targetRoot, sub);
    try {
      await fs.mkdir(dst, { recursive: true });
      const entries = await fs.readdir(src, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const srcFile = join(src, entry.name);
        const dstFile = join(dst, entry.name);
        if (existsSync(dstFile)) continue;
        await fs.copyFile(srcFile, dstFile);
        copied += 1;
      }
    } catch (err) {
      logger.warn(`No se pudo migrar ${sub}: ${(err as Error).message}`);
    }
  }
  if (copied > 0) {
    logger.log(`Migrados ${copied} archivos de ${legacyRoot} a ${targetRoot}`);
  }
}
