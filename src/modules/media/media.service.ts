import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryProvider } from './cloudinary.provider';
import { CreateMediaDto } from './dto/create-media.dto';

// Allowed MIME types
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

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

    const folder =
      this.config.get<string>('CLOUDINARY_UPLOAD_FOLDER') ?? 'portfolio';

    this.logger.log(`Uploading "${file.originalname}" to Cloudinary folder "${folder}"…`);

    const result = await this.cloudinary.uploadBuffer(
      file.buffer,
      file.originalname,
      folder,
    );

    const media = await this.prisma.media.create({
      data: {
        cloudinaryUrl: result.cloudinaryUrl,
        publicId: result.publicId,
        alt: dto.alt,
        width: result.width,
        height: result.height,
        type: file.mimetype,
      },
    });

    this.logger.log(`Uploaded: ${result.publicId}`);
    return media;
  }

  // ── Delete from Cloudinary + DB ──────────────────────────────────────────
  async remove(id: string) {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) {
      throw new NotFoundException(`Media "${id}" not found.`);
    }

    try {
      await this.cloudinary.deleteByPublicId(media.publicId);
    } catch (err: unknown) {
      // Log but don't block DB cleanup if Cloudinary delete fails
      this.logger.warn(`Cloudinary delete failed for "${media.publicId}": ${String(err)}`);
    }

    return this.prisma.media.delete({ where: { id } });
  }
}
