import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateConfigDto {
  @ApiPropertyOptional({ description: 'Human-readable label for the option set' })
  @IsString()
  @IsOptional()
  label?: string;

  @ApiProperty({ description: 'JSON array of { value, label }' })
  @IsArray()
  items: { value: string; label: string }[];
}
