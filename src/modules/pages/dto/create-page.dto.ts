import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PageType } from '@prisma/client';

export class CreatePageDto {
  @ApiProperty({ example: 'home' })
  @IsString()
  slug: string;

  @ApiProperty({ example: 'Home' })
  @IsString()
  title: string;

  @ApiProperty({ enum: PageType })
  @IsEnum(PageType)
  type: PageType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  metaTitle?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  metaDescription?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ogImage?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  navLabel?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  navOrder?: number;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  showInNav?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  published?: boolean;
}
