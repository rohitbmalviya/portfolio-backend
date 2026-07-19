import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description:
      'Refresh token (from login response). Optional when the `refresh_token` httpOnly cookie is present — the cookie is preferred and checked first.',
  })
  @IsString()
  @IsOptional()
  refreshToken?: string;
}
