/**
 * email-templates.ts
 *
 * Pure functions that return full RFC 2822-safe HTML strings for transactional emails.
 *
 * THEMING STRATEGY
 * ─────────────────
 * Default = LIGHT via inline styles on every element.  This guarantees correct rendering
 * in every email client (Gmail web, Outlook, Yahoo Mail, etc.) that ignores <style> blocks.
 *
 * A single <style> block in <head> holds one @media (prefers-color-scheme: dark) rule-set.
 * Every element that needs a dark-mode colour carries a semantic CSS class AND an inline
 * light-mode style.  Clients that honour the media query (Apple Mail, iOS Mail, Outlook.com,
 * Thunderbird, Spark) will apply the !important dark overrides and switch to the dark palette
 * automatically — following the recipient's OS preference.  Clients that strip <style>
 * (Gmail web) always see the clean light version.
 *
 * PALETTES
 * ─────────
 * LIGHT — page #f4f6f8 · card #ffffff · inner #f8fafc · border #e5e7eb
 *         text #111827 · muted #6b7280 · link #0891b2
 *         callout bg #ecfeff border #a5f3fc text #155e75
 *         button bg #06b6d4 text #06141a
 *
 * DARK  — page #0a0e14 · card #0f1620 · inner #161f2b · border #22303c
 *         text #e6edf3 · muted #8b949e · link #22d3ee
 *         callout bg #0e2a33 border #155e6b text #7fe3f0
 *         button bg #22d3ee text #06141a
 *
 * HEADER/FOOTER always use the dark chrome (#0b1117) in BOTH modes — no class needed.
 */

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface ReplySignature {
  name: string;
  role: string;
  portfolioUrl: string;
  linkedinUrl: string;
  githubUrl: string;
  email: string;
}

export interface NotificationEmailParams {
  name: string;
  email: string;
  subject: string | null;
  message: string;
  receivedAt: Date;
  adminUrl: string;
}

export interface ReplyEmailParams {
  bodyText: string;
  signature: ReplySignature;
}

// ── Private helpers ───────────────────────────────────────────────────────────

/** Escape user-supplied strings for safe HTML insertion. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Strip protocol + trailing slash for a cleaner link display.
 * "https://rohitmalviya.dev/" → "rohitmalviya.dev"
 */
function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/**
 * Format a Date as "28 Jun 2026 · 1:00 PM" (UTC, no server-timezone surprise).
 */
function formatEmailDate(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const rawHour = d.getUTCHours();
  const minute = String(d.getUTCMinutes()).padStart(2, '0');
  const ampm = rawHour >= 12 ? 'PM' : 'AM';
  const h12 = rawHour % 12 || 12;
  return `${day} ${month} ${year} · ${h12}:${minute} ${ampm}`;
}

/** Shared <style> block for dark-mode overrides (notification email). */
const NOTIFICATION_DARK_STYLES = `
<style>
  @media (prefers-color-scheme: dark) {
    .page-bg        { background-color: #0a0e14 !important; }
    .card           { background-color: #0f1620 !important; border-color: #22303c !important; }
    .card-hdr-border{ border-bottom-color: #22303c !important; }
    .inner          { background-color: #161f2b !important; border-color: #22303c !important; }
    .text-body      { color: #b6c2cf !important; }
    .text-primary   { color: #e6edf3 !important; }
    .text-muted     { color: #8b949e !important; }
    .text-link      { color: #22d3ee !important; }
    .callout        { background-color: #0e2a33 !important; border-color: #155e6b !important; color: #7fe3f0 !important; }
    .callout-strong { color: #bff3f9 !important; }
    .btn-wrap       { background-color: #22d3ee !important; }
  }
</style>
`.trim();

/** Shared <style> block for dark-mode overrides (reply email). */
const REPLY_DARK_STYLES = `
<style>
  @media (prefers-color-scheme: dark) {
    .page-bg      { background-color: #0a0e14 !important; }
    .card         { background-color: #0f1620 !important; border-color: #22303c !important; }
    .body-text    { color: #e6edf3 !important; }
    .sig-divider  { border-top-color: #22303c !important; }
    .sig-name     { color: #e6edf3 !important; }
    .sig-role     { color: #8b949e !important; }
    .sig-link     { color: #22d3ee !important; }
    .sig-sep      { color: #3a4654 !important; }
    .sig-email    { color: #8b949e !important; }
  }
</style>
`.trim();

// ── Public template functions ─────────────────────────────────────────────────

/**
 * HTML for the admin notification email (From: you → To: you, Reply-To: visitor).
 *
 * Structure: branded dark header · meta card (From/Email/Subject/Received) ·
 * message block · "↩ just hit Reply" callout · "Open in admin →" button · dark footer.
 */
export function notificationEmailHtml(params: NotificationEmailParams): string {
  const { name, email, subject, message, receivedAt, adminUrl } = params;
  const safeSubject = subject ?? '(none)';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>New Portfolio Message</title>
  ${NOTIFICATION_DARK_STYLES}
</head>
<body class="page-bg" style="margin:0; padding:0; background:#f4f6f8; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <!-- Page background wrapper (doubles the body bg for clients that strip body styles) -->
  <table role="presentation" class="page-bg" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;">
    <tr><td style="padding:32px 12px;" align="center">

      <!-- Card -->
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" class="card"
             style="max-width:560px; width:100%; background:#ffffff; border:1px solid #e5e7eb; border-radius:16px; overflow:hidden;">

        <!-- Header — always dark chrome -->
        <tr><td class="card-hdr-border" style="padding:22px 28px; border-bottom:1px solid #e5e7eb; background:#0b1117;">
          <span style="display:inline-block; width:32px; height:32px; background:#22d3ee; color:#06141a; border-radius:8px; text-align:center; line-height:32px; font-weight:800; font-size:14px; vertical-align:middle; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">RM</span>
          <span style="color:#e6edf3; font-size:12px; letter-spacing:2.5px; margin-left:12px; font-weight:700; vertical-align:middle;">NEW PORTFOLIO MESSAGE</span>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:28px;">
          <p class="text-body" style="margin:0 0 22px; color:#4b5563; font-size:15px; line-height:1.6;">You received a new message via your portfolio contact form.</p>

          <!-- Meta card -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="inner"
                 style="background:#f8fafc; border:1px solid #e5e7eb; border-radius:12px;">
            <tr><td style="padding:16px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px; width:100%;">
                <tr>
                  <td class="text-muted" style="color:#6b7280; padding:4px 18px 4px 0; width:84px; vertical-align:top;">From</td>
                  <td class="text-primary" style="color:#111827; font-weight:600;">${esc(name)}</td>
                </tr>
                <tr>
                  <td class="text-muted" style="color:#6b7280; padding:4px 18px 4px 0; vertical-align:top;">Email</td>
                  <td><a href="mailto:${esc(email)}" class="text-link" style="color:#0891b2; text-decoration:none;">${esc(email)}</a></td>
                </tr>
                <tr>
                  <td class="text-muted" style="color:#6b7280; padding:4px 18px 4px 0; vertical-align:top;">Subject</td>
                  <td class="text-primary" style="color:#111827;">${esc(safeSubject)}</td>
                </tr>
                <tr>
                  <td class="text-muted" style="color:#6b7280; padding:4px 18px 4px 0; vertical-align:top;">Received</td>
                  <td class="text-primary" style="color:#111827;">${formatEmailDate(receivedAt)}</td>
                </tr>
              </table>
            </td></tr>
          </table>

          <!-- Message label -->
          <p class="text-muted" style="margin:24px 0 8px; color:#6b7280; font-size:11px; letter-spacing:1.5px; font-weight:700;">// MESSAGE</p>

          <!-- Message body -->
          <p class="text-primary" style="margin:0; color:#111827; font-size:15px; line-height:1.65; white-space:pre-wrap;">${esc(message)}</p>

          <!-- "just hit Reply" callout -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
            <tr><td class="callout" style="background:#ecfeff; border:1px solid #a5f3fc; border-radius:10px; padding:13px 16px; color:#155e75; font-size:14px;">
              ↩&nbsp; Just hit <strong class="callout-strong" style="color:#0e7490;">Reply</strong> — it goes straight to ${esc(name)}.
            </td></tr>
          </table>

          <!-- Admin button -->
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px;">
            <tr><td class="btn-wrap" style="border-radius:9px; background:#06b6d4;">
              <a href="${esc(adminUrl)}" style="display:inline-block; padding:11px 22px; color:#06141a; font-weight:700; font-size:14px; text-decoration:none;">Open in admin &#8594;</a>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer — always dark chrome -->
        <tr><td style="padding:16px 28px; background:#0b1117; border-top:1px solid #22303c; color:#5b6772; font-size:12px;">
          Rohit Malviya &#8212; Portfolio contact
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * HTML for the visitor reply email (From: you → To: visitor).
 *
 * Structure: card with reply body text + branded signature block
 * (RM monogram, name, role, portfolio · LinkedIn · GitHub, email).
 */
export function replyEmailHtml(params: ReplyEmailParams): string {
  const { bodyText, signature } = params;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Reply from Rohit Malviya</title>
  ${REPLY_DARK_STYLES}
</head>
<body class="page-bg" style="margin:0; padding:0; background:#f4f6f8; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <!-- Page background wrapper -->
  <table role="presentation" class="page-bg" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;">
    <tr><td style="padding:32px 12px;" align="center">

      <!-- Card -->
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" class="card"
             style="max-width:560px; width:100%; background:#ffffff; border:1px solid #e5e7eb; border-radius:16px; overflow:hidden;">
        <tr><td style="padding:30px 30px 26px;">

          <!-- Reply body text -->
          <div class="body-text" style="color:#111827; font-size:15px; line-height:1.65; white-space:pre-wrap;">${esc(bodyText)}</div>

          <!-- Branded signature -->
          <table role="presentation" cellpadding="0" cellspacing="0" class="sig-divider"
                 style="margin-top:28px; border-top:1px solid #e5e7eb; padding-top:18px; width:100%;">
            <tr>
              <!-- RM monogram — always cyan on dark, both modes -->
              <td style="vertical-align:top; padding-right:16px; width:46px;">
                <span style="display:inline-block; width:46px; height:46px; background:#22d3ee; color:#06141a; border-radius:11px; text-align:center; line-height:46px; font-weight:800; font-size:17px; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">RM</span>
              </td>
              <td style="vertical-align:top;">
                <div class="sig-name" style="font-weight:700; color:#111827; font-size:15px;">${esc(signature.name)}</div>
                <div class="sig-role" style="color:#6b7280; font-size:13px; margin-bottom:8px;">${esc(signature.role)}</div>
                <div style="font-size:13px; line-height:1.5;">
                  <a href="${esc(signature.portfolioUrl)}" class="sig-link" style="color:#0891b2; text-decoration:none;">${esc(displayUrl(signature.portfolioUrl))}</a>
                  <span class="sig-sep" style="color:#d1d5db;">&nbsp;&#183;&nbsp;</span>
                  <a href="${esc(signature.linkedinUrl)}" class="sig-link" style="color:#0891b2; text-decoration:none;">LinkedIn</a>
                  <span class="sig-sep" style="color:#d1d5db;">&nbsp;&#183;&nbsp;</span>
                  <a href="${esc(signature.githubUrl)}" class="sig-link" style="color:#0891b2; text-decoration:none;">GitHub</a>
                </div>
                <div style="font-size:13px; margin-top:3px;">
                  <a href="mailto:${esc(signature.email)}" class="sig-email" style="color:#6b7280; text-decoration:none;">${esc(signature.email)}</a>
                </div>
              </td>
            </tr>
          </table>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
