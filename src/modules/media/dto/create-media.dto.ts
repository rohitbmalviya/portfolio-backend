import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Optional metadata that can accompany a file upload.
 * The actual file is delivered via multipart/form-data field "file".
 */
export class CreateMediaDto {
  @ApiPropertyOptional({ description: 'Alt text for accessibility' })
  @IsString()
  @IsOptional()
  alt?: string;

  @ApiPropertyOptional({ description: 'Library category, e.g. "Projects"' })
  @IsString()
  @IsOptional()
  category?: string;
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
