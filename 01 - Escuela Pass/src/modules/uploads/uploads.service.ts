import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { Repository } from 'typeorm';
import { SchoolEntity } from '../../database/entities/school.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';

@Injectable()
export class UploadsService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(SchoolEntity)
    private readonly schoolsRepository: Repository<SchoolEntity>
  ) {}

  async setUserAvatar(
    actorUserId: string,
    actorRole: UserRole,
    targetUserId: string,
    filename: string
  ): Promise<{ avatarUrl: string }> {
    await this.assertStaffCanSetUserAvatar(actorUserId, actorRole, targetUserId);
    const relative = `/uploads/avatars/${filename}`;
    const user = await this.usersRepository.findOne({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    this.removeStoredFile(user.avatarPath);
    user.avatarPath = relative;
    await this.usersRepository.save(user);
    return { avatarUrl: relative };
  }

  async setSchoolLogo(schoolId: string, filename: string): Promise<{ logoUrl: string }> {
    const school = await this.schoolsRepository.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('Escuela no encontrada');
    const relative = `/uploads/school-logos/${filename}`;
    this.removeStoredFile(school.logoPath);
    school.logoPath = relative;
    await this.schoolsRepository.save(school);
    return { logoUrl: relative };
  }

  private async assertStaffCanSetUserAvatar(
    actorUserId: string,
    actorRole: UserRole,
    targetUserId: string
  ): Promise<void> {
    if (actorRole === UserRole.ADMIN) return;
    if (actorRole !== UserRole.DOCENTE && actorRole !== UserRole.ADMINISTRATIVO) {
      throw new ForbiddenException('Solo personal autorizado puede subir fotos de perfil.');
    }
    const [actor, target] = await Promise.all([
      this.usersRepository.findOne({ where: { id: actorUserId } }),
      this.usersRepository.findOne({ where: { id: targetUserId } })
    ]);
    if (!target) throw new NotFoundException('Usuario no encontrado');
    if (!actor?.schoolId || !target.schoolId || actor.schoolId !== target.schoolId) {
      throw new ForbiddenException('Solo puede establecer foto para usuarios de su misma institución.');
    }
  }

  private removeStoredFile(relativePath: string | null | undefined): void {
    if (!relativePath?.startsWith('/uploads/')) return;
    const abs = join(process.cwd(), relativePath.replace(/^\//, ''));
    if (existsSync(abs)) {
      try {
        unlinkSync(abs);
      } catch {
        /* ignore */
      }
    }
  }
}
