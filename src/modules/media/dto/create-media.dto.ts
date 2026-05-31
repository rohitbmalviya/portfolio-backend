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
}
