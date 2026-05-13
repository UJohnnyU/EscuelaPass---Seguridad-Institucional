import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { UserEntity } from '../../database/entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? ''
    });
  }

  async validate(payload: { sub?: string; email?: string; role?: string; schoolId?: string | null }) {
    if (!payload?.sub) {
      throw new UnauthorizedException('Token inválido');
    }
    // Cierra la brecha de "JWT vivo aunque la cuenta este inactiva":
    // verificamos `status` en cada request autenticada.
    const user = await this.usersRepository.findOne({
      where: { id: payload.sub },
      select: ['id', 'email', 'role', 'schoolId', 'status', 'canAccessCampus']
    });
    if (!user) {
      throw new UnauthorizedException('Token inválido');
    }
    if (!user.status) {
      throw new UnauthorizedException('Cuenta inactiva');
    }
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId ?? null,
      canAccessCampus: user.canAccessCampus
    };
  }
}
