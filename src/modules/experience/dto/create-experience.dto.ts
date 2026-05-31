import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
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

  @ApiProperty({ description: 'ISO date string YYYY-MM-DD', example: '2022-01-01' })
  @IsString()
  startDate: string;

  @ApiProperty({ description: 'ISO date string or "Present"', example: 'Present' })
  @IsString()
  endDate: string;

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
