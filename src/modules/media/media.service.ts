import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryProvider } from './cloudinary.provider';
import { CreateMediaDto, UpdateMediaDto } from './dto/create-media.dto';
import { ListMediaDto } from './dto/list-media.dto';
import {
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
  DEFAULT_MEDIA_PAGE_SIZE,
} from './media.constants';

// Raster images we convert to WebP on upload (smaller, faster).
// SVG (vector), GIF (animation), and PDF (document) are left untouched.
const WEBP_CONVERTIBLE = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

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

// ── ownerType → stored category label ────────────────────────────────────────

const OWNER_TYPE_CATEGORY: Record<string, string> = {
  project: 'Projects',
  blog: 'Blogs',
  page: 'Page',
  section: 'Section',
  experience: 'Experience',
  education: 'Education',
  achievement: 'Achievement',
  settings: 'Settings',
};

/** Derives the stored category label from the ownerType field. Falls back to 'Raw'. */
function categoryFor(ownerType?: string): string {
  return (ownerType && OWNER_TYPE_CATEGORY[ownerType]) ?? 'Raw';
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
  //
  // Backward compatible: when `page`/`pageSize` are both absent this returns
  // the bare array exactly as before (existing admin UI keeps working
  // unchanged). Providing either param opts into `{ data, meta }` pagination.
  async findAll(query?: ListMediaDto) {
    if (!query || (query.page === undefined && query.pageSize === undefined)) {
      return this.prisma.media.findMany({
        orderBy: { createdAt: 'desc' },
      });
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_MEDIA_PAGE_SIZE;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.media.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.media.count(),
    ]);

    return { items, meta: { total, page, pageSize } };
  }

  // ── Upload a file buffer to Cloudinary, persist a Media row ─────────────
  async uploadFile(file: Express.Multer.File, dto: CreateMediaDto, createdById?: string) {
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

    const base = this.config.get<string>('CLOUDINARY_UPLOAD_FOLDER') ?? 'portfolio';
    const nameWithoutExt = file.originalname.replace(/\.[^/.]+$/, '');
    const name = slugify(nameWithoutExt);
    const toWebp = WEBP_CONVERTIBLE.has(file.mimetype);

    const { ownerType, ownerId, entitySlug, usage } = dto;

    // ── Build the ownerType-scoped public_id ──────────────────────────────
    //
    // Multi-image owners (project / blog / section): filename is embedded in
    // the publicId — collision-safe across different owners, idempotent on
    // re-upload, and reorder-safe (order is stored separately, not in the path).
    //
    // Single-slot owners (page / experience / education / achievement /
    // settings): a fixed role word is used so the asset is always at the same
    // path regardless of what the file was named — overwriting a previous
    // upload is intentional and safe.
    let publicId: string;

    switch (ownerType) {
      case 'project': {
        const slug = entitySlug?.trim();
        if (!slug) {
          throw new BadRequestException('entitySlug is required for project uploads');
        }
        publicId = `${base}/projects/${slugify(slug)}/${name}`;
        break;
      }
      case 'blog': {
        const slug = entitySlug?.trim();
        if (!slug) {
          throw new BadRequestException('entitySlug is required for blog uploads');
        }
        publicId = `${base}/blogs/${slugify(slug)}/${name}`;
        break;
      }
      case 'section': {
        if (!ownerId?.trim()) {
          throw new BadRequestException('ownerId is required for section uploads');
        }
        publicId = `${base}/section/${ownerId}/${name}`;
        break;
      }
      case 'page': {
        if (!ownerId?.trim()) {
          throw new BadRequestException('ownerId is required for page uploads');
        }
        publicId = `${base}/page/${ownerId}/og`;
        break;
      }
      case 'experience': {
        if (!ownerId?.trim()) {
          throw new BadRequestException('ownerId is required for experience uploads');
        }
        publicId = `${base}/experience/${ownerId}/logo`;
        break;
      }
      case 'education': {
        if (!ownerId?.trim()) {
          throw new BadRequestException('ownerId is required for education uploads');
        }
        publicId = `${base}/education/${ownerId}/logo`;
        break;
      }
      case 'achievement': {
        if (!ownerId?.trim()) {
          throw new BadRequestException('ownerId is required for achievement uploads');
        }
        publicId = `${base}/achievement/${ownerId}/image`;
        break;
      }
      case 'settings': {
        if (!usage?.trim()) {
          throw new BadRequestException('usage is required for settings uploads');
        }
        if (usage !== 'resume' && usage !== 'og') {
          throw new BadRequestException('usage must be "resume" or "og" for settings uploads');
        }
        publicId = `${base}/settings/${usage}`;
        break;
      }
      default: {
        // No ownerType provided — raw fallback for unowned assets.
        publicId = `${base}/raw/raw-${name}`;
        break;
      }
    }

    const assetFolder = publicId.slice(0, publicId.lastIndexOf('/'));

    this.logger.log(
      `Uploading "${file.originalname}" → publicId "${publicId}" (folder "${assetFolder}")${toWebp ? ' (→ WebP)' : ''}…`,
    );

    const result = await this.cloudinary.uploadBuffer(file.buffer, {
      publicId,
      assetFolder,
      format: toWebp ? 'webp' : undefined,
      overwrite: true,
    });

    // Common writable fields (used by both the create and update arms).
    const commonData = {
      cloudinaryUrl: result.cloudinaryUrl,
      alt: dto.alt,
      width: result.width,
      height: result.height,
      type: toWebp ? 'image/webp' : file.mimetype,
      // Stored category is derived from ownerType: Projects / Blogs / Page /
      // Section / Experience / Education / Achievement / Settings / Raw
      category: categoryFor(dto.ownerType),
      // Deferred-upload flow: link to owner at upload time when provided
      ...(dto.ownerId ? { ownerId: dto.ownerId } : {}),
      ...(dto.ownerType ? { ownerType: dto.ownerType } : {}),
      ...(dto.usage ? { usage: dto.usage } : {}),
      ...(dto.order !== undefined ? { order: dto.order } : {}),
    };

    // Upsert by publicId: re-uploading the same asset (same publicId) overwrites
    // it on Cloudinary AND refreshes the existing Media row, instead of failing
    // the unique constraint. New publicId → create; existing → update.
    const media = await this.prisma.media.upsert({
      where: { publicId: result.publicId },
      create: {
        publicId: result.publicId,
        ...commonData,
        // Uploader is the creator for audit purposes
        ...(createdById ? { createdById } : {}),
      },
      update: {
        ...commonData,
        // A re-upload is an update — stamp the updater for audit purposes
        ...(createdById ? { updatedById: createdById } : {}),
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
        this.logger.warn(`Cloudinary destroy failed for "${media.publicId}": ${String(err)}`);
      }
    }

    return this.prisma.media.delete({ where: { id } });
  }
}
