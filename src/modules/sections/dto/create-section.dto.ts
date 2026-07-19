import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { SectionType } from '@prisma/client';

export class CreateSectionDto {
  @ApiProperty({ description: 'ID of the parent page' })
  @IsString()
  pageId: string;

  @ApiProperty({ enum: SectionType })
  @IsEnum(SectionType)
  type: SectionType;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Typed JSON payload — shape depends on section type (see step4 §3.2)',
    type: 'object',
  })
  @IsObject()
  @IsOptional()
  data?: Record<string, unknown>;
}
