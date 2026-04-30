import { existsSync, mkdirSync } from 'fs';
import { isAbsolute, join } from 'path';

/**
 * Resuelve la carpeta raíz donde se guardan los archivos subidos.
 *
 * En Railway montamos un Volume persistente y lo exponemos por la variable de
 * entorno UPLOADS_DIR (por ejemplo `/data`). Si no existe se usa `./uploads`
 * relativa al cwd actual para que el desarrollo local siga funcionando.
 */
export function uploadsRootDir(): string {
  const fromEnv = process.env.UPLOADS_DIR?.trim();
  const root = fromEnv
    ? (isAbsolute(fromEnv) ? fromEnv : join(process.cwd(), fromEnv))
    : join(process.cwd(), 'uploads');
  if (!existsSync(root)) {
    mkdirSync(root, { recursive: true });
  }
  return root;
}

export function uploadsSubDir(sub: string): string {
  const dir = join(uploadsRootDir(), sub);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Dada una ruta pública como `/uploads/school-logos/abc.png`, intenta resolver
 * la ruta absoluta del archivo en disco. Revisa primero el directorio
 * configurado (UPLOADS_DIR) y, si el archivo no existe allí, regresa al
 * tradicional `./uploads` dentro del cwd. Devuelve `null` si no existe en
 * ninguno de los dos lugares.
 */
export function resolveUploadFile(publicPath: string | null | undefined): string | null {
  if (!publicPath) return null;
  const trimmed = publicPath.trim();
  if (!trimmed || !trimmed.startsWith('/uploads/')) return null;
  const rel = trimmed.replace(/^\/uploads\//, '');
  try {
    const candidates = [join(uploadsRootDir(), rel), join(process.cwd(), 'uploads', rel)];
    for (const abs of candidates) {
      if (existsSync(abs)) return abs;
    }
    return null;
  } catch {
    return null;
  }
}
