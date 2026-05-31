import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { AdminUser } from '@prisma/client';

/**
 * Reads the JWT from either:
 *   1. the `access_token` httpOnly cookie  (admin app, browser)
 *   2. the Authorization: Bearer <token>   (Swagger, programmatic clients)
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 1. httpOnly cookie
        (req: Request): string | null =>
          (req?.cookies as Record<string, string>)?.['access_token'] ?? null,
        // 2. Bearer header
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AdminUser> {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('User no longer exists.');
    }
    return user;
  }
}
