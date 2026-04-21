import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { Request } from 'express';
import { UserRole } from '../../database/entities/user.entity';
import { uploadsRootDir } from '../../lib/uploads-path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

type JwtUser = { userId: string; role: UserRole };

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      ok: true,
      service: 'escuela-pass-backend',
      timestamp: new Date().toISOString()
    };
  }

  /** Diagnóstico de almacenamiento local (solo ADMIN de plataforma). */
  @Get('storage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  storage(@Req() req: Request & { user: JwtUser }) {
    const root = uploadsRootDir();
    const upDir = process.env.UPLOADS_DIR?.trim() || '(default ./uploads bajo cwd)';
    let totalBytes = 0;
    let fileCount = 0;
    const walk = (dir: string, depth: number) => {
      if (depth > 12 || !existsSync(dir)) return;
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const p = join(dir, e.name);
        try {
          if (e.isDirectory()) walk(p, depth + 1);
          else {
            const st = statSync(p);
            totalBytes += st.size;
            fileCount += 1;
          }
        } catch {
          /* ignorar entradas no legibles */
        }
      }
    };
    walk(root, 0);
    return {
      ok: true,
      uploadsRoot: root,
      uploadsDirEnv: upDir,
      approxFiles: fileCount,
      approxBytes: totalBytes,
      checkedBy: req.user.userId
    };
  }
}
