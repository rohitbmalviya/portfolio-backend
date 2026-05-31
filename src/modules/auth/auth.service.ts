import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload, JwtRefreshPayload } from './interfaces/jwt-payload.interface';
import { AdminUser } from '@prisma/client';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ── Login ────────────────────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<{ user: Omit<AdminUser, 'passwordHash'>; tokens: AuthTokens }> {
    const user = await this.prisma.adminUser.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      // Use same message for both "not found" and "wrong password" — avoid enumeration
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    // Update lastLoginAt (fire-and-forget; don't block the response)
    void this.prisma.adminUser
      .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
      .catch((err: unknown) => this.logger.error('Failed to update lastLoginAt', err));

    const tokens = this.issueTokens({ sub: user.id, email: user.email });
    const { passwordHash: _removed, ...safeUser } = user;

    return { user: safeUser, tokens };
  }

  // ── Token issuance ───────────────────────────────────────────────────────

  issueTokens(payload: JwtPayload): AuthTokens {
    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN') ?? '7d',
    });

    const refreshPayload: JwtRefreshPayload = { ...payload, tokenType: 'refresh' };
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d',
    });

    return { accessToken, refreshToken };
  }

  // ── Refresh ──────────────────────────────────────────────────────────────

  async refresh(rawRefreshToken: string): Promise<AuthTokens> {
    let payload: JwtRefreshPayload;

    try {
      payload = this.jwtService.verify<JwtRefreshPayload>(rawRefreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired.');
    }

    if (payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('Token type mismatch.');
    }

    // Ensure the user still exists
    const user = await this.prisma.adminUser.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('User no longer exists.');
    }

    return this.issueTokens({ sub: user.id, email: user.email });
  }

  // ── Me ───────────────────────────────────────────────────────────────────

  getSafeUser(user: AdminUser): Omit<AdminUser, 'passwordHash'> {
    const { passwordHash: _removed, ...safeUser } = user;
    return safeUser;
  }
}
