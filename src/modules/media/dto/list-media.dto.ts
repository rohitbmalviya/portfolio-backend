import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_MEDIA_PAGE_SIZE } from '../media.constants';

/**
 * Optional pagination query params for GET /api/media.
 *
 * Backward compatible: when neither `page` nor `pageSize` is provided the
 * endpoint keeps returning the full, unpaginated list (existing admin UI
 * behaviour is unchanged). Providing either param opts into the paginated
 * `{ data, meta }` response shape.
 */
export class ListMediaDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    description: `Items per page (max ${MAX_MEDIA_PAGE_SIZE})`,
    minimum: 1,
    maximum: MAX_MEDIA_PAGE_SIZE,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_MEDIA_PAGE_SIZE)
  @IsOptional()
  pageSize?: number;
}
