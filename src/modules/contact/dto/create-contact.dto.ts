import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateContactDto {
  @ApiProperty({ description: 'Visitor display name', example: 'Jane Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Visitor email address', example: 'jane@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiPropertyOptional({
    description: 'Optional subject line',
    example: 'Collaboration opportunity',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  subject?: string;

  @ApiProperty({ description: 'Message body', example: 'Hi Rohit, I loved your portfolio...' })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  message: string;

  /**
   * Honeypot field — invisible to real visitors, only bots fill in every
   * input on a form. Must exist on the DTO or forbidNonWhitelisted (global
   * ValidationPipe) would 400 legitimate requests once the frontend sends
   * it. When non-empty, createFromWeb() silently no-ops instead of erroring
   * — bots must not learn their submission was detected.
   */
  @ApiPropertyOptional({
    description:
      'Honeypot — leave empty. Hidden from real visitors; used to silently drop bot submissions.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  website?: string;
}
