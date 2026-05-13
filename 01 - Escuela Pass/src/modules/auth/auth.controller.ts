import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

/**
 * Limite por IP para endpoints sensibles de autenticación. Por defecto 5/min;
 * parametrizable con AUTH_THROTTLE_LIMIT y AUTH_THROTTLE_TTL_MS (p. ej. E2E).
 * Complementa al lockout por cuenta del AuthService.
 */
function authThrottleConfig() {
  const limit = Math.max(1, Number(process.env.AUTH_THROTTLE_LIMIT ?? 5));
  const ttl = Math.max(1000, Number(process.env.AUTH_THROTTLE_TTL_MS ?? 60_000));
  return { default: { limit, ttl } };
}

type JwtReq = Request & { user: { userId: string; email: string; role: string } };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: JwtReq) {
    return this.authService.getMe(req.user.userId);
  }

  @Post('login')
  @Throttle(authThrottleConfig())
  login(@Body() payload: LoginDto) {
    return this.authService.login(payload);
  }

  @Post('refresh')
  refresh(@Body() payload: RefreshTokenDto) {
    return this.authService.refresh(payload);
  }

  @Post('logout')
  logout(@Body() payload: LogoutDto) {
    return this.authService.logout(payload);
  }

  @Post('forgot-password')
  @Throttle(authThrottleConfig())
  forgotPassword(@Body() payload: ForgotPasswordDto) {
    return this.authService.forgotPassword(payload);
  }

  @Post('reset-password')
  @Throttle(authThrottleConfig())
  resetPassword(@Body() payload: ResetPasswordDto) {
    return this.authService.resetPassword(payload);
  }
}
