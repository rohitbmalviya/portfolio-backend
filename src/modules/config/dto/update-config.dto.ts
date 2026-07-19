import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

/** A single option in a config set — { value, label }. */
export class ConfigItemDto {
  @ApiProperty()
  @IsString()
  value: string;

  @ApiProperty()
  @IsString()
  label: string;
}

export class UpdateConfigDto {
  @ApiPropertyOptional({ description: 'Human-readable label for the option set' })
  @IsString()
  @IsOptional()
  label?: string;

  @ApiProperty({ type: [ConfigItemDto], description: 'Array of { value, label }' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfigItemDto)
  items: ConfigItemDto[];
}
