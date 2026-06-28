import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { SkillLevel } from '@prisma/client';

export class CreateSkillDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  group: string;

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
