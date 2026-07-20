import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
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
  DEFAULT_REFRESH_EXPIRES_IN,
} from '../../common/utils/duration.util';

// Cookie names (constants so login/refresh/logout all agree on the same names)
const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';

// Cookie options shared across set/clear.
// maxAge is derived from JWT_EXPIRES_IN / JWT_REFRESH_EXPIRES_IN so the cookie
// lifetime can never drift from the token lifetime — both read the same env
// vars with the same defaults.
//
// In production the frontend (Vercel) and this API (Render) live on DIFFERENT
// sites, so the auth cookies must be SameSite=None + Secure or browsers will
// refuse to send them on cross-site fetches (login would silently break).
// Local dev is same-site over http, so Lax + non-secure keeps working there.
const isProduction = process.env['NODE_ENV'] === 'production';
const baseCookieOptions = {
  httpOnly: true,
  sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
  secure: isProduction,
};

const accessCookieOptions = {
  ...baseCookieOptions,
  path: '/',
  maxAge: parseDurationMs(process.env['JWT_EXPIRES_IN'] ?? DEFAULT_ACCESS_EXPIRES_IN),
};

// Path must be '/' — the admin frontend reaches this API through a Next.js
// rewrite (/backend-api/* → /api/*), and cookie paths are not rewritten by
// the proxy: a cookie scoped to /api/auth would never be sent to
// /backend-api/auth/refresh, silently breaking the silent-refresh flow.
const refreshCookieOptions = {
  ...baseCookieOptions,
  path: '/',
  maxAge: parseDurationMs(process.env['JWT_REFRESH_EXPIRES_IN'] ?? DEFAULT_REFRESH_EXPIRES_IN),
};

/** Set both auth cookies on the response — used by both login and refresh. */
function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, accessCookieOptions);
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, refreshCookieOptions);
}

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
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.authService.login(dto);

    // Set both the access and refresh tokens as httpOnly cookies
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

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
  /**
   * Reads the refresh token from the `refresh_token` httpOnly cookie first
   * (the primary flow for the Next.js admin), falling back to the request
   * body (kept for Swagger/API clients that can't rely on cookies).
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate access + refresh tokens using a refresh token' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawRefreshToken =
      (req.cookies as Record<string, string> | undefined)?.[REFRESH_TOKEN_COOKIE] ??
      dto.refreshToken;

    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token is missing.');
    }

    const tokens = await this.authService.refresh(rawRefreshToken);

    // Re-set both cookies with the freshly rotated tokens
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

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
  @ApiOperation({ summary: 'Clear the auth cookies (logout)' })
  logout(@Res({ passthrough: true }) res: Response) {
    // Options must match the ones used on set (minus maxAge) or the browser
    // will not clear the cookie.
    const { maxAge: _accessMaxAge, ...accessClearOptions } = accessCookieOptions;
    const { maxAge: _refreshMaxAge, ...refreshClearOptions } = refreshCookieOptions;
    res.clearCookie(ACCESS_TOKEN_COOKIE, accessClearOptions);
    res.clearCookie(REFRESH_TOKEN_COOKIE, refreshClearOptions);
    return { data: { message: 'Logged out successfully.' } };
  }
}
