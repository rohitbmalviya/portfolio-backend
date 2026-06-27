import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateExperienceDto {
  @ApiProperty()
  @IsString()
  role: string;

  @ApiProperty()
  @IsString()
  company: string;

  @ApiProperty()
  @IsString()
  location: string;

  @ApiProperty({ description: 'ISO date string', example: '2022-01-01' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({
    description: 'ISO date string, or null/omitted for "Present" (current role)',
    example: '2024-06-30',
    nullable: true,
  })
  @IsDateString()
  @IsOptional()
  endDate?: string | null;

  @ApiPropertyOptional({ description: 'Company logo URL (Cloudinary)' })
  @IsString()
  @IsOptional()
  logo?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  bullets?: string[];

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;
}
