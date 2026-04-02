import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { RefreshTokenEntity } from '../../database/entities/refresh-token.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokensRepository: Repository<RefreshTokenEntity>,
    private readonly jwtService: JwtService
  ) {}

  async login(payload: LoginDto) {
    const user = await this.usersRepository.findOne({ where: { email: payload.email } });
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const valid = await bcrypt.compare(payload.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    await this.refreshTokensRepository.delete({ userId: user.id });
    return this.issueTokens(user);
  }

  async refresh(payload: RefreshTokenDto) {
    let decoded: { sub: string; email?: string; role?: string } | null = null;
    try {
      decoded = this.jwtService.verify(payload.refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET
      }) as { sub: string };
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }
    const tokens = await this.refreshTokensRepository.find({
      where: { userId: decoded.sub },
      order: { expiresAt: 'DESC' },
      take: 50
    });
    let matchedToken: RefreshTokenEntity | null = null;
    for (const tokenRow of tokens) {
      const valid = await bcrypt.compare(payload.refreshToken, tokenRow.tokenHash);
      if (valid) {
        matchedToken = tokenRow;
        break;
      }
    }
    if (!matchedToken) {
      throw new UnauthorizedException('Refresh token inválido');
    }
    if (matchedToken.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expirado');
    }
    const user = await this.usersRepository.findOne({ where: { id: matchedToken.userId } });
    if (!user) {
      throw new UnauthorizedException('Usuario inválido');
    }
    // Rotación estricta: al refrescar, revocamos todos los refresh tokens del usuario.
    // Usamos query SQL explícita para evitar problemas de mapeo en filtros.
    await this.refreshTokensRepository
      .createQueryBuilder()
      .delete()
      .from(RefreshTokenEntity)
      .where('user_id = :userId', { userId: decoded.sub })
      .execute();
    return this.issueTokens(user);
  }

  async logout(payload: LogoutDto) {
    const decoded = this.jwtService.verify(payload.refreshToken, {
      secret: process.env.JWT_REFRESH_SECRET
    }) as { sub: string };
    const tokens = await this.refreshTokensRepository.find({
      where: { userId: decoded.sub },
      order: { expiresAt: 'DESC' },
      take: 50
    });
    let matchedToken: RefreshTokenEntity | null = null;
    for (const tokenRow of tokens) {
      const valid = await bcrypt.compare(payload.refreshToken, tokenRow.tokenHash);
      if (valid) {
        matchedToken = tokenRow;
        break;
      }
    }
    if (!matchedToken) {
      throw new UnauthorizedException('Refresh token inválido');
    }
    await this.refreshTokensRepository.delete({ userId: decoded.sub });
    await this.cleanupExpiredRefreshTokens(decoded.sub);
    return { message: 'Logout exitoso' };
  }

  private async issueTokens(user: UserEntity) {
    const jwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role
    };
    const accessToken = await this.jwtService.signAsync(jwtPayload, {
      secret: process.env.JWT_SECRET,
      expiresIn: this.parseDurationToSeconds(process.env.JWT_EXPIRES_IN ?? '1d')
    });
    // Refresh token único (aunque se emita en el mismo segundo).
    // Agregamos un claim aleatorio (`nonce`) para evitar tokens idénticos.
    const refreshToken = await this.jwtService.signAsync({ ...jwtPayload, nonce: randomUUID() }, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: this.parseDurationToSeconds(process.env.JWT_REFRESH_EXPIRES_IN ?? '7d')
    });
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + this.parseDurationToMs(process.env.JWT_REFRESH_EXPIRES_IN ?? '7d'));

    // Mantener un solo refresh activo por usuario (simplifica rotación y sesiones en dev).
    await this.refreshTokensRepository
      .createQueryBuilder()
      .delete()
      .from(RefreshTokenEntity)
      .where('user_id = :userId', { userId: user.id })
      .execute();

    const tokenEntity = this.refreshTokensRepository.create({
      userId: user.id,
      tokenHash: refreshTokenHash,
      expiresAt
    });
    await this.refreshTokensRepository.save(tokenEntity);
    return {
      message: 'Login OK',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName
      }
    };
  }

  private parseDurationToMs(value: string): number {
    if (value.endsWith('d')) return Number(value.replace('d', '')) * 24 * 60 * 60 * 1000;
    if (value.endsWith('h')) return Number(value.replace('h', '')) * 60 * 60 * 1000;
    if (value.endsWith('m')) return Number(value.replace('m', '')) * 60 * 1000;
    return 7 * 24 * 60 * 60 * 1000;
  }

  private parseDurationToSeconds(value: string): number {
    if (value.endsWith('d')) return Number(value.replace('d', '')) * 24 * 60 * 60;
    if (value.endsWith('h')) return Number(value.replace('h', '')) * 60 * 60;
    if (value.endsWith('m')) return Number(value.replace('m', '')) * 60;
    return 24 * 60 * 60;
  }

  private async cleanupExpiredRefreshTokens(userId: string) {
    await this.refreshTokensRepository
      .createQueryBuilder()
      .delete()
      .from(RefreshTokenEntity)
      .where('user_id = :userId', { userId })
      .andWhere('expires_at < NOW()')
      .execute();
  }
}
