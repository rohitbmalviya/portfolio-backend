import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 'my-project' })
  @IsString()
  slug: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  oneLiner: string;

  @ApiProperty()
  @IsString()
  role: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  stack?: string[];

  @ApiProperty()
  @IsString()
  metric: string;

  @ApiPropertyOptional()
  @IsUrl()
  @IsOptional()
  liveUrl?: string;

  @ApiProperty()
  @IsString()
  overview: string;

  @ApiProperty()
  @IsString()
  contribution: string;

  @ApiProperty()
  @IsString()
  body: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  featured?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  published?: boolean;
}
