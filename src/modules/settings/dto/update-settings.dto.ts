import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
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
    description: 'JSON array of { type: string, value: string } social links',
    type: 'array',
  })
  @IsArray()
  @IsOptional()
  socials?: { type: string; value: string }[];

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
