/**
 * duration.util.ts
 *
 * Converts a JWT-style duration string to milliseconds so cookie maxAge values
 * are always derived from the same env vars as the tokens — drift is impossible.
 *
 * Supported units: s (seconds), m (minutes), h (hours), d (days).
 * Examples: '1d' → 86_400_000  ·  '15m' → 900_000  ·  '7d' → 604_800_000
 */

/** Default JWT access-token lifetime.  Used by both AuthService and AuthController. */
export const DEFAULT_ACCESS_EXPIRES_IN = '1d';

/** Default JWT refresh-token lifetime.  Used by both AuthService and AuthController. */
export const DEFAULT_REFRESH_EXPIRES_IN = '7d';

/**
 * Parse a duration string like `'1d'`, `'7d'`, `'15m'`, `'3600s'` into milliseconds.
 *
 * @throws {Error} when the string is not a positive integer followed by s/m/h/d.
 */
export function parseDurationMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) {
    throw new Error(
      `parseDurationMs: unrecognised duration "${duration}". ` +
        'Expected a positive integer followed by s/m/h/d (e.g. "1d", "15m", "3600s").',
    );
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1_000;
    case 'm':
      return value * 60 * 1_000;
    case 'h':
      return value * 60 * 60 * 1_000;
    case 'd':
      return value * 24 * 60 * 60 * 1_000;
    default:
      // Unreachable — regex guarantees [smhd], but TypeScript requires the branch.
      throw new Error(`parseDurationMs: unknown unit "${unit}"`);
  }
}
