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
