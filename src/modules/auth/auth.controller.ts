import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AdminUser } from '@prisma/client';
import {
  parseDurationMs,
  DEFAULT_ACCESS_EXPIRES_IN,
} from '../../common/utils/duration.util';

// Access-token cookie name (constant so both login + logout use the same name)
const ACCESS_TOKEN_COOKIE = 'access_token';

// Cookie options shared across set/clear.
// maxAge is derived from JWT_EXPIRES_IN so the cookie lifetime can never drift
// from the token lifetime — both read the same env var with the same default.
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  // In production the cookie should be sent only over HTTPS.
  // We check NODE_ENV so local dev (http://localhost) still works.
  secure: process.env['NODE_ENV'] === 'production',
  path: '/',
  maxAge: parseDurationMs(process.env['JWT_EXPIRES_IN'] ?? DEFAULT_ACCESS_EXPIRES_IN),
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── POST /api/auth/login ─────────────────────────────────────────────────
  /**
   * Rate-limit login aggressively (5 attempts per minute per IP).
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login — returns JWT in both cookie and body' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.authService.login(dto);

    // Set the access token as an httpOnly cookie
    res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, cookieOptions);

    return {
      data: {
        user,
        // Also return the token in the body so the Next.js admin can store it
        // in memory or read it programmatically (avoids needing credentials:include everywhere)
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    };
  }

  // ── GET /api/auth/me ─────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Return the authenticated admin user' })
  me(@CurrentUser() user: AdminUser) {
    return { data: this.authService.getSafeUser(user) };
  }

  // ── POST /api/auth/refresh ───────────────────────────────────────────────
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate access token using a refresh token' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.refresh(dto.refreshToken);

    // Re-set the cookie with the fresh access token
    res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, cookieOptions);

    return {
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    };
  }

  // ── POST /api/auth/logout ────────────────────────────────────────────────
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear the auth cookie (logout)' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    return { data: { message: 'Logged out successfully.' } };
  }
}
