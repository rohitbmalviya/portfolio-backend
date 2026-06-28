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
