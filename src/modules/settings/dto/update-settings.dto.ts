import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { DefaultTheme } from '@prisma/client';

/** A single social link — { type, value }. */
export class SocialLinkDto {
  @ApiProperty()
  @IsString()
  type: string;

  @ApiProperty()
  @IsString()
  value: string;
}

export class UpdateSettingsDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  tagline?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({
    description: 'Array of { type, value } social links',
    type: [SocialLinkDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  @IsOptional()
  socials?: SocialLinkDto[];

  @ApiPropertyOptional({ enum: DefaultTheme })
  @IsEnum(DefaultTheme)
  @IsOptional()
  defaultTheme?: DefaultTheme;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  brandAccent?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  footerText?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ogTitle?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ogDescription?: string;
}
