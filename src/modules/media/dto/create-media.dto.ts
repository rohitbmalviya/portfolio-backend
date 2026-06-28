import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * Optional metadata that can accompany a file upload.
 * The actual file is delivered via multipart/form-data field "file".
 */
export class CreateMediaDto {
  @ApiPropertyOptional({ description: 'Alt text for accessibility' })
  @IsString()
  @IsOptional()
  alt?: string;

  @ApiPropertyOptional({ description: 'Library category, e.g. "projects"' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({
    description:
      'URL-safe slug of the owning entity (required for projects / blogs uploads)',
  })
  @IsString()
  @IsOptional()
  entitySlug?: string;

  @ApiPropertyOptional({
    description:
      'Image sequence number within the entity (1-based). Coerced from string because it arrives via multipart form-data.',
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  sequence?: number;
}

export class UpdateMediaDto {
  @ApiPropertyOptional({ description: 'Alt text for accessibility' })
  @IsString()
  @IsOptional()
  alt?: string;

  @ApiPropertyOptional({ description: 'Library category' })
  @IsString()
  @IsOptional()
  category?: string;
}
