/**
 * contact.constants.ts
 *
 * Named constants for the contact module — eliminates magic strings and
 * duplicated owner-default values throughout contact.service.ts.
 */

// ── Message direction ─────────────────────────────────────────────────────────

/** Mirrors the `direction` column on ContactMessage. */
export enum ContactDirection {
  Inbound = 'inbound',
  Outbound = 'outbound',
}

// ── Message source ────────────────────────────────────────────────────────────

/** Mirrors the `source` column on ContactMessage. */
export enum ContactSource {
  /** Submitted through the public contact form. */
  Web = 'web',
  /** Sent from the admin panel (reply / compose). */
  App = 'app',
  /** Synced in from Gmail via the Gmail API. */
  Gmail = 'gmail',
  /** Auto-generated admin notification email (sent when a visitor submits the form). */
  Notification = 'notification',
}

// ── Snippet ───────────────────────────────────────────────────────────────────

/** Maximum character length of the thread-list preview snippet. */
export const SNIPPET_MAX_LENGTH = 120;

// ── Owner fallback defaults ───────────────────────────────────────────────────

/**
 * Fallback values used when SiteSettings cannot be loaded from the DB.
 *
 * The primary source of truth is always the SiteSettings singleton row
 * (and env vars where noted).  This object is the last-resort fallback only
 * — it prevents the app from hard-crashing when the DB row is missing.
 */
export const OWNER_DEFAULTS = {
  name: 'Rohit Malviya',
  role: 'Full-Stack Engineer',
  email: 'rohitbmalviya@gmail.com',
  github: 'https://github.com/rohithumancloud',
  linkedin: 'https://linkedin.com/in/rohitbmalviya',
  portfolio: 'https://rohitmalviya.dev',
  brandAccent: '#22d3ee',
} as const;
