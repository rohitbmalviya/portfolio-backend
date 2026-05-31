import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AdminUser } from '@prisma/client';

/**
 * @CurrentUser() — extracts the authenticated AdminUser from the request.
 * Only valid inside routes protected by JwtAuthGuard.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AdminUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AdminUser }>();
    return request.user;
  },
);
