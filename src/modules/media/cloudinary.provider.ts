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
   * Always signed via the server API secret — no unsigned uploads.
   */
  async uploadBuffer(
    buffer: Buffer,
    originalName: string,
    folder: string,
    /** When set (e.g. 'webp'), Cloudinary stores the asset in this format. */
    format?: string,
  ): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          // Use the original filename (without extension) as a public_id hint
          public_id: `${Date.now()}-${originalName.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9_-]/gi, '_')}`,
          overwrite: false,
          resource_type: 'auto',
          // Convert to the requested format (e.g. WebP) at upload time.
          ...(format ? { format } : {}),
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
   */
  async deleteByPublicId(publicId: string): Promise<void> {
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
