import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { SkillGroup, SkillLevel } from '@prisma/client';

export class CreateSkillDto {
  @ApiProperty({ enum: SkillGroup })
  @IsEnum(SkillGroup)
  group: SkillGroup;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: SkillLevel })
  @IsEnum(SkillLevel)
  level: SkillLevel;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;
}
