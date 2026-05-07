import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import * as nodemailer from 'nodemailer';
import { DataSource, Repository } from 'typeorm';
import { RefreshTokenEntity } from '../../database/entities/refresh-token.entity';
import { SchoolEntity } from '../../database/entities/school.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

export type ProfileContactItem = {
  fullName: string;
  phone: string | null;
  subtitle?: string;
};

export type ProfileContactSection = {
  title: string;
  items: ProfileContactItem[];
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokensRepository: Repository<RefreshTokenEntity>,
    @InjectRepository(SchoolEntity)
    private readonly schoolsRepository: Repository<SchoolEntity>,
    private readonly jwtService: JwtService,
    @InjectDataSource()
    private readonly dataSource: DataSource
  ) {}

  async getMe(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    const contactSections = await this.buildProfileContactSections(user);
    const schoolLogoUrl = await this.resolveSchoolLogoUrl(user.schoolId);
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      schoolId: user.schoolId,
      canAccessCampus: user.canAccessCampus,
      phone: user.phone ?? null,
      avatarUrl: user.avatarPath ?? null,
      schoolLogoUrl,
      contactSections
    };
  }

  private async resolveSchoolLogoUrl(schoolId: string | null | undefined): Promise<string | null> {
    if (!schoolId) return null;
    const school = await this.schoolsRepository.findOne({
      where: { id: schoolId },
      select: ['logoPath']
    });
    return school?.logoPath ?? null;
  }

  private async buildProfileContactSections(user: UserEntity): Promise<ProfileContactSection[]> {
    if (user.role === UserRole.ALUMNO) {
      const parents = await this.dataSource.query<
        { fullName: string; phone: string | null; relationship: string }[]
      >(
        `SELECT u.full_name AS "fullName", u.phone, sp.relationship
         FROM students st
         JOIN student_parents sp ON sp.student_id = st.id
         JOIN parents p ON p.id = sp.parent_id
         JOIN users u ON u.id = p.user_id
         WHERE st.user_id = $1
         ORDER BY sp.is_primary DESC, u.full_name`,
        [user.id]
      );
      const teachers = await this.dataSource.query<
        {
          fullName: string;
          phone: string | null;
          subjectName: string | null;
          groupName: string | null;
        }[]
      >(
        `SELECT DISTINCT u.full_name AS "fullName",
                u.phone,
                subj.name AS "subjectName",
                g.name AS "groupName"
         FROM students st
         JOIN teacher_groups tg ON tg.group_id = st.group_id
         JOIN teachers t ON t.id = tg.teacher_id
         JOIN users u ON u.id = t.user_id
         LEFT JOIN subjects subj ON subj.id = tg.subject_id
         LEFT JOIN groups g ON g.id = st.group_id
         WHERE st.user_id = $1 AND st.group_id IS NOT NULL
         ORDER BY u.full_name, subj.name NULLS LAST`,
        [user.id]
      );
      const sections: ProfileContactSection[] = [];
      if (parents.length) {
        sections.push({
          title: 'Padres',
          items: parents.map((r) => ({
            fullName: r.fullName,
            phone: r.phone,
            subtitle: r.relationship
          }))
        });
      }
      if (teachers.length) {
        sections.push({
          title: 'Docentes',
          items: teachers.map((r) => {
            const parts = [r.subjectName, r.groupName].filter(Boolean);
            return {
              fullName: r.fullName,
              phone: r.phone,
              subtitle: parts.length ? parts.join(' · ') : 'Docente'
            };
          })
        });
      }
      return sections;
    }
    if (user.role === UserRole.DOCENTE) {
      const rows = await this.dataSource.query<
        {
          fullName: string;
          phone: string | null;
          relationship: string;
          studentName: string;
          groupName: string | null;
        }[]
      >(
        `SELECT u.full_name AS "fullName",
                u.phone,
                sp.relationship,
                stu.full_name AS "studentName",
                g.name AS "groupName"
         FROM teachers t
         JOIN (SELECT DISTINCT teacher_id, group_id FROM teacher_groups) tg ON tg.teacher_id = t.id
         JOIN students st ON st.group_id = tg.group_id
         JOIN student_parents sp ON sp.student_id = st.id
         JOIN parents p ON p.id = sp.parent_id
         JOIN users u ON u.id = p.user_id
         JOIN users stu ON stu.id = st.user_id
         LEFT JOIN groups g ON g.id = st.group_id
         WHERE t.user_id = $1
         ORDER BY u.full_name, stu.full_name`,
        [user.id]
      );
      if (!rows.length) return [];
      return [
        {
          title: 'Familias de sus grupos',
          items: rows.map((r) => {
            const g = r.groupName ? ` · ${r.groupName}` : '';
            return {
              fullName: r.fullName,
              phone: r.phone,
              subtitle: `${r.relationship} · Alumno: ${r.studentName}${g}`
            };
          })
        }
      ];
    }
    if (user.role === UserRole.PADRE) {
      const rows = await this.dataSource.query<
        {
          fullName: string;
          phone: string | null;
          subjectName: string | null;
          groupName: string | null;
          childName: string;
        }[]
      >(
        `SELECT u.full_name AS "fullName",
                u.phone,
                subj.name AS "subjectName",
                g.name AS "groupName",
                child.full_name AS "childName"
         FROM parents par
         JOIN student_parents sp ON sp.parent_id = par.id
         JOIN students st ON st.id = sp.student_id
         JOIN users child ON child.id = st.user_id
         JOIN teacher_groups tg ON tg.group_id = st.group_id
         JOIN teachers t ON t.id = tg.teacher_id
         JOIN users u ON u.id = t.user_id
         LEFT JOIN subjects subj ON subj.id = tg.subject_id
         LEFT JOIN groups g ON g.id = st.group_id
         WHERE par.user_id = $1 AND st.group_id IS NOT NULL
         ORDER BY child.full_name, subj.name NULLS LAST, u.full_name`,
        [user.id]
      );
      if (!rows.length) return [];
      return [
        {
          title: 'Docentes de sus hijos',
          items: rows.map((r) => {
            const parts = [r.subjectName, r.groupName].filter(Boolean);
            const ctx = parts.length ? parts.join(' · ') : 'Grupo';
            return {
              fullName: r.fullName,
              phone: r.phone,
              subtitle: `${r.childName} · ${ctx}`
            };
          })
        }
      ];
    }
    return [];
  }

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
    let decoded: { sub: string } | null = null;
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
    await this.refreshTokensRepository.delete({ userId: decoded.sub });
    await this.cleanupExpiredRefreshTokens(decoded.sub);
    return { message: 'Logout exitoso' };
  }

  private async issueTokens(user: UserEntity) {
    const jwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId
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
    const schoolLogoUrl = await this.resolveSchoolLogoUrl(user.schoolId);
    return {
      message: 'Login OK',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        schoolId: user.schoolId,
        avatarUrl: user.avatarPath ?? null,
        schoolLogoUrl
      }
    };
  }

  /**
   * Inicia el flujo de recuperación de contraseña. Siempre devuelve 200 para no revelar emails.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const MSG = 'Si el correo está registrado, recibirá un enlace para restablecer su contraseña.';
    const user = await this.usersRepository.findOne({
      where: { email: dto.email.toLowerCase().trim() }
    });
    if (!user) return { message: MSG };

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1_000); // 1 hora

    user.passwordResetToken = token;
    user.passwordResetExpiresAt = expiresAt;
    await this.usersRepository.save(user);

    const frontendBase = (process.env.CORS_ORIGIN ?? '').replace(/\/$/, '');
    const resetUrl = `${frontendBase}/restablecer-contrasena?token=${token}`;
    await this.sendResetEmail(user.email, user.fullName, resetUrl);

    return { message: MSG };
  }

  /**
   * Valida el token y actualiza la contraseña.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.usersRepository.findOne({
      where: { passwordResetToken: dto.token }
    });
    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      throw new BadRequestException(
        'El enlace de restablecimiento no es válido o ha expirado. Solicite uno nuevo.'
      );
    }
    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    user.passwordResetToken = null;
    user.passwordResetExpiresAt = null;
    await this.usersRepository.save(user);

    /* Invalidar todos los refresh tokens al cambiar la contraseña. */
    await this.refreshTokensRepository
      .createQueryBuilder()
      .delete()
      .from(RefreshTokenEntity)
      .where('user_id = :uid', { uid: user.id })
      .execute();

    return { message: 'Contraseña actualizada correctamente. Ya puede iniciar sesión.' };
  }

  private async sendResetEmail(email: string, fullName: string, resetUrl: string): Promise<void> {
    const host = process.env.SMTP_HOST?.trim();
    if (!host) {
      this.logger.warn('SMTP_HOST no configurado; correo de restablecimiento omitido.');
      return;
    }
    const port = Number(process.env.SMTP_PORT ?? 587);
    const smtpUser = process.env.SMTP_USER?.trim();
    const smtpPass = process.env.SMTP_PASS?.trim();
    const from = process.env.SMTP_FROM?.trim() ?? smtpUser ?? 'no-reply@escuelapass.app';

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined
    });

    const html = `
      <p>Hola, <strong>${fullName}</strong>.</p>
      <p>Recibimos una solicitud para restablecer la contraseña de su cuenta en <strong>Escuela Pass</strong>.</p>
      <p>
        <a href="${resetUrl}" style="background:#1e293b;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">
          Restablecer contraseña
        </a>
      </p>
      <p>Si no solicitó esto, ignore este correo. El enlace expira en 1 hora.</p>
      <hr>
      <p style="font-size:12px;color:#64748b">
        Si el botón no funciona, copie y pegue esta URL en su navegador:<br>${resetUrl}
      </p>
    `;

    try {
      await transporter.sendMail({
        from,
        to: email,
        subject: 'Restablecer contraseña – Escuela Pass',
        html
      });
    } catch (err) {
      this.logger.error(`Error enviando correo de restablecimiento a ${email}`, err);
    }
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
