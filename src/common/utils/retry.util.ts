/**
 * Generic async retry with exponential backoff.
 *
 * Retries `fn` up to `attempts` times. Only retries when `isRetryable(err)`
 * returns true (default: always). Waits `baseDelayMs * 2^(attempt-1)` between
 * tries. Re-throws the last error once attempts are exhausted or the error is
 * deemed non-retryable.
 *
 * Reusable across any flaky network call (Cloudinary uploads/deletes, etc.).
 */
export interface RetryOptions {
  /** Total attempts including the first (default 3). */
  attempts?: number;
  /** Base backoff in ms; doubles each retry (default 500). */
  baseDelayMs?: number;
  /** Decide whether an error is worth retrying (default: retry all). */
  isRetryable?: (err: unknown) => boolean;
  /** Side-effect hook before each retry (e.g. logging). */
  onRetry?: (err: unknown, attempt: number) => void;
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 500;
  const isRetryable = opts.isRetryable ?? (() => true);

  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt >= attempts || !isRetryable(err)) throw err;
      opts.onRetry?.(err, attempt);
      const delay = baseDelayMs * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
}

/**
 * Retryable-error heuristic for Cloudinary (and similar HTTP APIs):
 * - HTTP 5xx and 429 (rate-limit) → transient, retry.
 * - Other HTTP 4xx (bad file, auth, validation) → permanent, do NOT retry.
 * - No http_code (network drop / timeout, e.g. ECONNRESET, "Request Timeout")
 *   → transient, retry.
 */
export function isTransientUploadError(err: unknown): boolean {
  const e = err as { http_code?: number } | null;
  if (e && typeof e.http_code === 'number') {
    return e.http_code >= 500 || e.http_code === 429;
  }
  return true;
}
