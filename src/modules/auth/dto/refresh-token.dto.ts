import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token (from login response)' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
