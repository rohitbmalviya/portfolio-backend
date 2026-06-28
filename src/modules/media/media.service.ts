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
import { MEDIA_BUCKET_LABEL, bucketFor } from './media.constants';

// Allowed MIME types
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf', // résumé / document uploads
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// Raster images we convert to WebP on upload (smaller, faster).
// SVG (vector), GIF (animation), and PDF (document) are left untouched.
const WEBP_CONVERTIBLE = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

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

    // Base folder (env) + one of three subfolders chosen by the upload's category:
    //   projects → portfolio/projects · blogs → portfolio/blogs · everything else → portfolio/raw
    const base =
      this.config.get<string>('CLOUDINARY_UPLOAD_FOLDER') ?? 'portfolio';
    const bucket = bucketFor(dto.category); // MediaBucket
    const folder = `${base}/${bucket}`;
    const toWebp = WEBP_CONVERTIBLE.has(file.mimetype);

    this.logger.log(
      `Uploading "${file.originalname}" to "${folder}"${toWebp ? ' (→ WebP)' : ''}…`,
    );

    const result = await this.cloudinary.uploadBuffer(
      file.buffer,
      file.originalname,
      folder,
      toWebp ? 'webp' : undefined,
    );

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
      },
    });

    this.logger.log(`Uploaded: ${result.publicId}`);
    return media;
  }

  // ── Update metadata (category / alt) ─────────────────────────────────────
  async update(id: string, dto: UpdateMediaDto) {
    const existing = await this.prisma.media.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Media "${id}" not found.`);
    }
    return this.prisma.media.update({ where: { id }, data: dto });
  }

  // ── Delete from Cloudinary + DB ──────────────────────────────────────────
  async remove(id: string) {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) {
      throw new NotFoundException(`Media "${id}" not found.`);
    }

    // Seeded local assets (publicId "local/…") aren't on Cloudinary — skip.
    if (!media.publicId.startsWith('local/')) {
      try {
        await this.cloudinary.deleteByPublicId(media.publicId);
      } catch (err: unknown) {
        // Log but don't block DB cleanup if Cloudinary delete fails
        this.logger.warn(`Cloudinary delete failed for "${media.publicId}": ${String(err)}`);
      }
    }

    return this.prisma.media.delete({ where: { id } });
  }
}
