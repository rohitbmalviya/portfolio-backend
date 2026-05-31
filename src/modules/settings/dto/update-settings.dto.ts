import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import { DefaultTheme } from '@prisma/client';

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
    description: 'JSON: { github: string, linkedin: string, twitter?: string }',
    type: 'object',
  })
  @IsObject()
  @IsOptional()
  socials?: Record<string, string>;

  @ApiPropertyOptional()
  @IsUrl()
  @IsOptional()
  resumeUrl?: string;

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
