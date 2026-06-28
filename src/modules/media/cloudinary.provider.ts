import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

export interface CloudinaryUploadResult {
  cloudinaryUrl: string;
  publicId: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
}

/**
 * CloudinaryProvider — thin wrapper around the Cloudinary v2 SDK.
 * Configured from CLOUDINARY_* env vars on module init.
 * All uploads are server-signed (no unsigned public uploads).
 */
@Injectable()
export class CloudinaryProvider implements OnModuleInit {
  private readonly logger = new Logger(CloudinaryProvider.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    cloudinary.config({
      cloud_name: this.config.getOrThrow<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.config.getOrThrow<string>('CLOUDINARY_API_KEY'),
      api_secret: this.config.getOrThrow<string>('CLOUDINARY_API_SECRET'),
      secure: true,
    });
    this.logger.log('Cloudinary SDK configured.');
  }

  /**
   * Upload a buffer (from multer memory storage) to Cloudinary.
   * The caller is responsible for building the full `publicId` (path + filename
   * without extension).  Always signed via the server API secret.
   *
   * @param buffer   - File data from multer memory storage.
   * @param opts.publicId  - Full Cloudinary public_id (no extension), e.g.
   *                         `portfolio/projects/my-slug/project-image-1`.
   * @param opts.format    - Target format override (e.g. `'webp'`).
   * @param opts.overwrite - Whether to overwrite an existing asset with the
   *                         same public_id (default: true).
   */
  async uploadBuffer(
    buffer: Buffer,
    opts: { publicId: string; format?: string; overwrite?: boolean },
  ): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: opts.publicId,
          overwrite: opts.overwrite ?? true,
          resource_type: 'auto',
          ...(opts.format ? { format: opts.format } : {}),
        },
        (error, result) => {
          if (error || !result) {
            reject(error ?? new Error('Cloudinary upload returned no result.'));
            return;
          }
          resolve(this.mapResult(result));
        },
      );
      uploadStream.end(buffer);
    });
  }

  /**
   * Delete an asset by its publicId.
   * @alias destroy
   */
  async deleteByPublicId(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }

  /**
   * Destroy an asset by its publicId (alias for deleteByPublicId,
   * consistent with Cloudinary SDK naming).
   */
  async destroy(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }

  private mapResult(result: UploadApiResponse): CloudinaryUploadResult {
    return {
      cloudinaryUrl: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    };
  }
}
