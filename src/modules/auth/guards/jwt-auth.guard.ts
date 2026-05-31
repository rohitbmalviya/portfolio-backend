import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JwtAuthGuard — apply to any route that requires authentication.
 * Uses the 'jwt' Passport strategy (cookie OR Bearer header).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
