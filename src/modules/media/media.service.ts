import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryProvider } from './cloudinary.provider';
import { CreateMediaDto, UpdateMediaDto } from './dto/create-media.dto';
import {
  MediaBucket,
  MEDIA_BUCKET_LABEL,
  bucketFor,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
} from './media.constants';

// Raster images we convert to WebP on upload (smaller, faster).
// SVG (vector), GIF (animation), and PDF (document) are left untouched.
const WEBP_CONVERTIBLE = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

/**
 * Converts an arbitrary string into a URL/path-safe slug.
 * - Lowercases the input.
 * - Replaces any run of non-alphanumeric characters with a single hyphen.
 * - Strips leading and trailing hyphens.
 */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryProvider,
    private readonly config: ConfigService,
  ) {}

  // ── List all (admin only) ────────────────────────────────────────────────
  findAll() {
    return this.prisma.media.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Upload a file buffer to Cloudinary, persist a Media row ─────────────
  async uploadFile(
    file: Express.Multer.File,
    dto: CreateMediaDto,
    createdById?: string,
  ) {
    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `File type "${file.mimetype}" is not allowed. Allowed types: ${[...ALLOWED_MIME_TYPES].join(', ')}.`,
      );
    }

    // Validate size (belt-and-suspenders — multer limits are also configured)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File exceeds maximum size of ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`,
      );
    }

    const base =
      this.config.get<string>('CLOUDINARY_UPLOAD_FOLDER') ?? 'portfolio';
    const bucket = bucketFor(dto.category); // MediaBucket
    const toWebp = WEBP_CONVERTIBLE.has(file.mimetype);

    // ── Build the structured public_id ────────────────────────────────────
    let publicId: string;

    if (bucket === MediaBucket.Projects || bucket === MediaBucket.Blogs) {
      // entitySlug is mandatory for entity-scoped uploads.
      const entitySlug = dto.entitySlug?.trim();
      if (!entitySlug) {
        throw new BadRequestException(
          'entitySlug is required for project/blog uploads',
        );
      }
      const seq = dto.sequence ?? 1;
      if (bucket === MediaBucket.Projects) {
        publicId = `${base}/projects/${slugify(entitySlug)}/project-image-${seq}`;
      } else {
        publicId = `${base}/blogs/${slugify(entitySlug)}/blog-image-${seq}`;
      }
    } else {
      // Raw — derive the filename from the original upload name (no extension).
      const nameWithoutExt = file.originalname.replace(/\.[^/.]+$/, '');
      publicId = `${base}/raw/raw-${slugify(nameWithoutExt)}`;
    }

    this.logger.log(
      `Uploading "${file.originalname}" → publicId "${publicId}"${toWebp ? ' (→ WebP)' : ''}…`,
    );

    const result = await this.cloudinary.uploadBuffer(file.buffer, {
      publicId,
      format: toWebp ? 'webp' : undefined,
      overwrite: true,
    });

    const media = await this.prisma.media.create({
      data: {
        cloudinaryUrl: result.cloudinaryUrl,
        publicId: result.publicId,
        alt: dto.alt,
        width: result.width,
        height: result.height,
        type: toWebp ? 'image/webp' : file.mimetype,
        // Stored category mirrors the bucket: Projects / Blogs / Raw
        category: MEDIA_BUCKET_LABEL[bucket],
        // Uploader is the creator for audit purposes
        ...(createdById ? { createdById } : {}),
        // Deferred-upload flow: link to owner at upload time when provided
        ...(dto.ownerId ? { ownerId: dto.ownerId } : {}),
        ...(dto.ownerType ? { ownerType: dto.ownerType } : {}),
        ...(dto.usage ? { usage: dto.usage } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
      },
    });

    this.logger.log(`Uploaded: ${result.publicId}`);
    return media;
  }

  // ── Update metadata (order / alt / usage / category) ─────────────────────
  async update(id: string, dto: UpdateMediaDto, userId?: string) {
    const existing = await this.prisma.media.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Media "${id}" not found.`);
    }
    return this.prisma.media.update({
      where: { id },
      data: { ...dto, ...(userId ? { updatedById: userId } : {}) },
    });
  }

  // ── Hard-delete: remove from Cloudinary AND from DB ──────────────────────
  async remove(id: string) {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) {
      throw new NotFoundException(`Media "${id}" not found.`);
    }

    // Seeded local assets (publicId "local/…") aren't on Cloudinary — skip.
    if (!media.publicId.startsWith('local/')) {
      try {
        await this.cloudinary.destroy(media.publicId);
      } catch (err: unknown) {
        // Log but don't block DB cleanup if Cloudinary delete fails
        this.logger.warn(
          `Cloudinary destroy failed for "${media.publicId}": ${String(err)}`,
        );
      }
    }

    return this.prisma.media.delete({ where: { id } });
  }
}
