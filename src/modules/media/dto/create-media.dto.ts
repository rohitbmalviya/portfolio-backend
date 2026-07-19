import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * Optional metadata that can accompany a file upload.
 * The actual file is delivered via multipart/form-data field "file".
 *
 * Deferred-upload flow: pass `ownerId` + `ownerType` so the Media row
 * is linked to its owner the moment it is created (no separate linking
 * call required).
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
    description: 'URL-safe slug of the owning entity (required for projects / blogs uploads)',
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

  // ── Polymorphic owner fields (deferred-upload flow) ────────────────────────

  @ApiPropertyOptional({
    description:
      'ID of the owning entity (project id, blog post id, etc.). When provided the Media row is linked at upload time.',
  })
  @IsString()
  @IsOptional()
  ownerId?: string;

  @ApiPropertyOptional({
    description:
      "Type discriminator for the owner. One of: 'project' | 'blog' | 'experience' | 'education' | 'achievement' | 'page' | 'settings'",
  })
  @IsString()
  @IsOptional()
  ownerType?: string;

  @ApiPropertyOptional({
    description:
      "Usage discriminator for multi-purpose owners, e.g. 'resume' or 'og' on SiteSettings.",
  })
  @IsString()
  @IsOptional()
  usage?: string;

  @ApiPropertyOptional({
    description:
      'Display order within the owning collection (0-based). Coerced from string because it arrives via multipart form-data.',
    minimum: 0,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;
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

  @ApiPropertyOptional({
    description: "Usage discriminator, e.g. 'resume' or 'og'.",
  })
  @IsString()
  @IsOptional()
  usage?: string;

  @ApiPropertyOptional({
    description: 'Display order within the owning collection (0-based).',
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;
}
