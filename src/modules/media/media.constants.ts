// ============================================================
//  Media buckets — the ONLY three Cloudinary subfolders /
//  Media categories. Single source of truth for the backend.
//  Keep the values in sync with the frontend `MediaCategory`
//  enum (portfolio-frontend/src/lib/media.ts).
// ============================================================

/** Cloudinary subfolder + Media category bucket. Values are the subfolder names. */
export enum MediaBucket {
  Projects = 'projects',
  Blogs = 'blogs',
  Raw = 'raw',
}

/** Human-readable label stored on the Media row + used for Library grouping. */
export const MEDIA_BUCKET_LABEL: Record<MediaBucket, string> = {
  [MediaBucket.Projects]: 'Projects',
  [MediaBucket.Blogs]: 'Blogs',
  [MediaBucket.Raw]: 'Raw',
};

/**
 * Resolves an incoming upload `category` to one of the three buckets.
 * Anything that isn't a known bucket falls back to Raw.
 */
export function bucketFor(category?: string): MediaBucket {
  const c = (category ?? '').toLowerCase().trim();
  if (c === MediaBucket.Projects) return MediaBucket.Projects;
  if (c === MediaBucket.Blogs) return MediaBucket.Blogs;
  return MediaBucket.Raw;
}

// ── Upload constraints ────────────────────────────────────────────────────────

/**
 * Maximum permitted upload size in bytes (10 MB).
 * Used by both the multer FileInterceptor limit and the service-layer guard
 * so the two values can never drift.
 */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * MIME types accepted for upload.
 * Validated in the service after multer has buffered the file.
 */
export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf', // résumé / document uploads
]);
