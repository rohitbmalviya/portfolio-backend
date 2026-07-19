import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { AdminUser } from '@prisma/client';
import { MediaService } from './media.service';
import { CreateMediaDto, UpdateMediaDto } from './dto/create-media.dto';
import { ListMediaDto } from './dto/list-media.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MAX_FILE_SIZE_BYTES } from './media.constants';

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  // ── GET /api/media — admin ───────────────────────────────────────────────
  //
  // Backward compatible: with no `page`/`pageSize` query params, the response
  // shape is exactly `{ data: Media[] }` as before. Passing either param opts
  // into `{ data: Media[], meta: { total, page, pageSize } }`.
  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] List all uploaded media (optionally paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async findAll(@Query() query: ListMediaDto) {
    const result = await this.mediaService.findAll(query);
    if (Array.isArray(result)) {
      return { data: result };
    }
    return { data: result.items, meta: result.meta };
  }

  // ── POST /api/media — admin (multipart file upload) ──────────────────────
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Upload an image to Cloudinary' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file (JPEG, PNG, WebP, GIF, SVG — max 10 MB)',
        },
        alt: { type: 'string', description: 'Optional alt text' },
        category: { type: 'string', description: 'Library bucket: "projects", "blogs", or "raw"' },
        entitySlug: {
          type: 'string',
          description: 'Entity slug — required for projects/blogs category',
        },
        sequence: { type: 'integer', description: 'Image sequence within the entity (1-based)' },
        ownerId: {
          type: 'string',
          description:
            'ID of the owning entity — links the asset at upload time (deferred-upload flow)',
        },
        ownerType: {
          type: 'string',
          description:
            "Owner type: 'project' | 'blog' | 'experience' | 'education' | 'achievement' | 'page' | 'settings'",
        },
        usage: {
          type: 'string',
          description: "Usage discriminator for multi-purpose owners, e.g. 'resume' or 'og'",
        },
        order: {
          type: 'integer',
          description: 'Display order within the owning collection (0-based)',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_FILE_SIZE_BYTES,
        files: 1,
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateMediaDto,
    @CurrentUser() user: AdminUser,
  ) {
    return { data: await this.mediaService.uploadFile(file, dto, user.id) };
  }

  // ── PATCH /api/media/:id — admin ─────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[Admin] Update a media asset — reorder (order), alt text, usage, or category',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMediaDto,
    @CurrentUser() user: AdminUser,
  ) {
    return { data: await this.mediaService.update(id, dto, user.id) };
  }

  // ── DELETE /api/media/:id — admin ────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Delete a media asset (Cloudinary + DB)' })
  async remove(@Param('id') id: string) {
    await this.mediaService.remove(id);
  }
}
