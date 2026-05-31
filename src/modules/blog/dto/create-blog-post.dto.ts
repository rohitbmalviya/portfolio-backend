import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
} from 'class-validator';

export class CreateBlogPostDto {
  @ApiProperty()
  @IsString()
  slug: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  excerpt: string;

  @ApiPropertyOptional()
  @IsUrl()
  @IsOptional()
  coverImage?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({ description: 'Full MDX body' })
  @IsString()
  body: string;

  @ApiPropertyOptional({ description: 'Estimated reading time in minutes' })
  @IsInt()
  @IsPositive()
  @IsOptional()
  readingTime?: number;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  published?: boolean;

  @ApiPropertyOptional({ description: 'ISO date string' })
  @IsDateString()
  @IsOptional()
  publishedAt?: string;
}
