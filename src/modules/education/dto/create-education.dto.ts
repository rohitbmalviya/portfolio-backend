import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateEducationDto {
  @ApiProperty()
  @IsString()
  degree: string;

  @ApiProperty()
  @IsString()
  school: string;

  @ApiProperty({ description: 'ISO date string', example: '2021-08-01' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({
    description: 'ISO date string, or null/omitted for ongoing ("Present")',
    example: '2024-06-30',
    nullable: true,
  })
  @IsDateString()
  @IsOptional()
  endDate?: string | null;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  detail?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;
}
