import { Injectable, Logger } from '@nestjs/common';
import { google, gmail_v1 } from 'googleapis';
import { ContactThread } from '@prisma/client';
import { ReplySignature, notificationEmailHtml, replyEmailHtml } from './email-templates';

export type { ReplySignature };

export interface NormalizedGmailMessage {
  gmailMessageId: string;
  fromEmail: string;
  bodyText: string;
  internalDate: Date;
}

/**
 * GmailService — wraps the Gmail REST API for two-way contact thread sync.
 *
 * Required OAuth2 scopes (grant these in Google Cloud Console):
 *   - https://www.googleapis.com/auth/gmail.send   (send messages)
 *   - https://www.googleapis.com/auth/gmail.readonly (read threads)
 *
 * Required env vars: GMAIL_USER, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN.
 * Optional env vars: ADMIN_MESSAGES_URL (default http://localhost:3000/admin/messages).
 *
 * When any required var is missing, isConfigured() returns false and all send/sync
 * operations become no-ops that log a warning — the contact form still saves to the DB.
 *
 * MIME format: every outgoing message is multipart/alternative with a text/plain fallback
 * part and a text/html branded-template part.  Clients that cannot render HTML fall back
 * to the plain-text part automatically per RFC 2046 §5.1.4.
 */
@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);

  private readonly gmailUser = process.env.GMAIL_USER;
  private readonly clientId = process.env.GOOGLE_CLIENT_ID;
  private readonly clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  private readonly refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  // ── Configuration guard ───────────────────────────────────────────────────

  isConfigured(): boolean {
    return !!(this.gmailUser && this.clientId && this.clientSecret && this.refreshToken);
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private getClient(): gmail_v1.Gmail {
    const auth = new google.auth.OAuth2(this.clientId, this.clientSecret);
    auth.setCredentials({ refresh_token: this.refreshToken });
    return google.gmail({ version: 'v1', auth });
  }

  /**
   * Build a multipart/alternative RFC 822 MIME message and return it as a
   * base64url string suitable for the Gmail API `raw` field.
   *
   * The message structure:
   *   headers (From, To, Subject, …)
   *   Content-Type: multipart/alternative; boundary="…"
   *
   *   --boundary
   *   Content-Type: text/plain; charset=utf-8
   *   Content-Transfer-Encoding: base64
   *   <base64-encoded plain text>
   *
   *   --boundary
   *   Content-Type: text/html; charset=utf-8
   *   Content-Transfer-Encoding: base64
   *   <base64-encoded HTML>
   *
   *   --boundary--
   *
   * The outer message is itself base64url-encoded for the Gmail REST API.
   */
  private buildMultipartRaw(
    headers: Record<string, string>,
    plainText: string,
    htmlText: string,
  ): string {
    // Unique boundary — safe characters only, no leading hyphens
    const boundary = `_PART_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    /** Wrap a base64 string at 76 characters per line (RFC 2045 §6.8). */
    const wrap76 = (b64: string): string => (b64.match(/.{1,76}/g) ?? [b64]).join('\r\n');

    const plainB64 = wrap76(Buffer.from(plainText, 'utf-8').toString('base64'));
    const htmlB64 = wrap76(Buffer.from(htmlText, 'utf-8').toString('base64'));

    // Build the top-level header block (caller supplies MIME-Version; we add Content-Type)
    const headerBlock = Object.entries(headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n');

    const mime = [
      headerBlock,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      plainB64,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      htmlB64,
      '',
      `--${boundary}--`,
    ].join('\r\n');

    // base64url-encode the entire RFC 822 message for the Gmail API
    return Buffer.from(mime)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Safely decode base64url (Gmail API uses url-safe base64).
   */
  private base64Decode(data: string): string {
    const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(normalized, 'base64').toString('utf-8');
  }

  /**
   * Extract the email address from a "Display Name <addr>" or bare "addr" header value.
   */
  private extractEmail(fromHeader: string): string {
    const match = fromHeader.match(/<([^>]+)>/);
    return match ? match[1].trim() : fromHeader.trim();
  }

  /**
   * Recursively find the text/plain body in a MIME message part tree.
   */
  private extractBody(payload: gmail_v1.Schema$MessagePart | null | undefined): string {
    if (!payload) return '';

    // Simple (non-multipart) message
    if (payload.body?.data) {
      return this.base64Decode(payload.body.data);
    }

    // Multipart: scan parts for text/plain
    const parts = payload.parts ?? [];
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return this.base64Decode(part.body.data);
      }
      // Recurse into nested multipart
      if (part.parts) {
        const nested = this.extractBody(part);
        if (nested) return nested;
      }
    }

    return '';
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Send a self-notification email (From: GMAIL_USER → To: GMAIL_USER, Reply-To: visitor).
   *
   * Sends multipart/alternative: a plain-text fallback and the branded HTML notification
   * template.  `adminUrl` defaults to process.env.ADMIN_MESSAGES_URL if not passed.
   *
   * @param senderName  Admin display name shown in the email footer (e.g. 'Rohit Malviya').
   * @param brandAccent Brand accent hex colour for the monogram chip (e.g. '#22d3ee').
   *
   * Returns the Gmail message ID and thread ID so the caller can persist them.
   */
  async sendNotification(
    thread: Pick<ContactThread, 'name' | 'email' | 'subject'>,
    bodyText: string,
    senderName: string,
    brandAccent: string,
  ): Promise<{ id: string; threadId: string }> {
    if (!this.isConfigured()) {
      this.logger.warn('GmailService not configured — sendNotification skipped');
      return { id: '', threadId: '' };
    }

    const adminUrl = process.env.ADMIN_MESSAGES_URL ?? 'http://localhost:3000/admin/messages';
    const receivedAt = new Date();
    const subject = `New portfolio message from ${thread.name}`;

    // ── Plain-text fallback ─────────────────────────────────────────────────
    const plain = [
      'You received a new message via your portfolio contact form.',
      '',
      `From:     ${thread.name}`,
      `Email:    ${thread.email}`,
      `Subject:  ${thread.subject ?? '(none)'}`,
      `Received: ${receivedAt.toUTCString()}`,
      '',
      '──────────────────────────────────────────',
      bodyText,
      '──────────────────────────────────────────',
      '',
      `↩ Reply to this email to respond directly to ${thread.name},`,
      'or use the admin panel to send a tracked reply.',
      '',
      `Admin panel: ${adminUrl}`,
    ].join('\n');

    // ── Branded HTML ────────────────────────────────────────────────────────
    const html = notificationEmailHtml({
      name: thread.name,
      email: thread.email,
      subject: thread.subject,
      message: bodyText,
      receivedAt,
      adminUrl,
      adminName: senderName,
      brandAccent,
    });

    const raw = this.buildMultipartRaw(
      {
        'MIME-Version': '1.0',
        From: this.gmailUser!,
        To: this.gmailUser!,
        'Reply-To': thread.email,
        Subject: subject,
      },
      plain,
      html,
    );

    const gmail = this.getClient();
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    const id = res.data.id;
    const threadId = res.data.threadId;
    if (!id || !threadId) {
      throw new Error('Gmail API returned empty id/threadId from send');
    }

    return { id, threadId };
  }

  /**
   * Send a brand-new outbound email (From: GMAIL_USER → To: any recipient) that starts
   * a fresh Gmail thread.  Uses the same multipart/alternative + branded HTML template
   * as sendReply but omits the threadId so Gmail creates a new thread.
   *
   * Returns both { id, threadId } so the caller can persist the Gmail references.
   */
  async sendCompose(
    to: string,
    subject: string | null,
    bodyText: string,
    signature: ReplySignature,
  ): Promise<{ id: string; threadId: string }> {
    if (!this.isConfigured()) {
      this.logger.warn('GmailService not configured — sendCompose skipped');
      return { id: '', threadId: '' };
    }

    const emailSubject = subject ?? '(no subject)';

    // ── Plain-text fallback ─────────────────────────────────────────────────
    const plain = [
      bodyText,
      '',
      '--',
      signature.name,
      signature.role,
      `${signature.portfolioUrl}  ·  LinkedIn: ${signature.linkedinUrl}  ·  GitHub: ${signature.githubUrl}`,
      signature.email,
    ].join('\n');

    // ── Branded HTML (reuses the same reply template) ───────────────────────
    const html = replyEmailHtml({ bodyText, signature });

    const raw = this.buildMultipartRaw(
      {
        'MIME-Version': '1.0',
        From: this.gmailUser!,
        To: to,
        Subject: emailSubject,
      },
      plain,
      html,
    );

    const gmail = this.getClient();
    // No threadId in requestBody → Gmail starts a new thread
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    const id = res.data.id;
    const threadId = res.data.threadId;
    if (!id || !threadId) {
      throw new Error('Gmail API returned empty id/threadId from sendCompose');
    }

    return { id, threadId };
  }

  /**
   * Remove the UNREAD label from a Gmail thread (mirror of markRead in the DB).
   *
   * Requires the gmail.modify scope.  Silently no-ops when Gmail is unconfigured
   * and catches any API error as a warning — never throws so callers never fail.
   */
  async markThreadRead(gmailThreadId: string): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn('GmailService not configured — markThreadRead skipped');
      return;
    }

    try {
      const gmail = this.getClient();
      await gmail.users.threads.modify({
        userId: 'me',
        id: gmailThreadId,
        requestBody: { removeLabelIds: ['UNREAD'] },
      });
    } catch (err) {
      this.logger.warn(
        `markThreadRead: Gmail API call failed for thread ${gmailThreadId} — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Send a reply from admin (GMAIL_USER) to the visitor.
   *
   * Sends multipart/alternative: a plain-text fallback (body + plain-text signature)
   * and the branded HTML reply template with the full signature block.
   *
   * Passes gmailThreadId so the message lands in the same Gmail thread AND in Sent.
   */
  async sendReply(
    thread: Pick<ContactThread, 'name' | 'email' | 'subject' | 'gmailThreadId'>,
    bodyText: string,
    signature: ReplySignature,
  ): Promise<{ id: string }> {
    if (!this.isConfigured()) {
      this.logger.warn('GmailService not configured — sendReply skipped');
      return { id: '' };
    }

    const subject = `Re: ${thread.subject ?? 'your message'}`;

    // ── Plain-text fallback ─────────────────────────────────────────────────
    const plain = [
      bodyText,
      '',
      '--',
      signature.name,
      signature.role,
      `${signature.portfolioUrl}  ·  LinkedIn: ${signature.linkedinUrl}  ·  GitHub: ${signature.githubUrl}`,
      signature.email,
    ].join('\n');

    // ── Branded HTML ────────────────────────────────────────────────────────
    const html = replyEmailHtml({ bodyText, signature });

    const raw = this.buildMultipartRaw(
      {
        'MIME-Version': '1.0',
        From: this.gmailUser!,
        To: thread.email,
        Subject: subject,
      },
      plain,
      html,
    );

    const gmail = this.getClient();
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw,
        // Keeps the reply inside the existing Gmail thread (and records it in Sent)
        threadId: thread.gmailThreadId ?? undefined,
      },
    });

    const id = res.data.id;
    if (!id) {
      throw new Error('Gmail API returned empty id from send');
    }

    return { id };
  }

  /**
   * Fetch all messages in a Gmail thread and normalise them.
   * Used by syncAll() to import visitor replies and admin Gmail replies into the DB.
   */
  async fetchThreadMessages(gmailThreadId: string): Promise<NormalizedGmailMessage[]> {
    if (!this.isConfigured()) return [];

    const gmail = this.getClient();
    const res = await gmail.users.threads.get({
      userId: 'me',
      id: gmailThreadId,
      format: 'full',
    });

    const messages = res.data.messages ?? [];
    return messages
      .filter((msg) => msg.id != null)
      .map((msg) => {
        const headers = msg.payload?.headers ?? [];
        const fromHeader = headers.find((h) => h.name?.toLowerCase() === 'from')?.value ?? '';
        return {
          gmailMessageId: msg.id as string,
          fromEmail: this.extractEmail(fromHeader),
          bodyText: this.extractBody(msg.payload),
          internalDate: new Date(Number(msg.internalDate ?? Date.now())),
        };
      });
  }
}
