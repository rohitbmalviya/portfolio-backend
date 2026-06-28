import { Injectable, Logger } from '@nestjs/common';
import { google, gmail_v1 } from 'googleapis';
import { ContactThread } from '@prisma/client';

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
 * When any is missing, isConfigured() returns false and all send/sync operations become no-ops
 * that log a warning — the contact form still saves messages to the database.
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
   * Encode a raw RFC 822 MIME message to base64url for the Gmail API.
   */
  private buildRaw(headers: Record<string, string>, body: string): string {
    const headerBlock = Object.entries(headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n');
    const message = `${headerBlock}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`;
    return Buffer.from(message)
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
   * Returns the Gmail message ID and thread ID so the caller can persist them for deduplication.
   */
  async sendNotification(
    thread: Pick<ContactThread, 'name' | 'email' | 'subject'>,
    bodyText: string,
  ): Promise<{ id: string; threadId: string }> {
    if (!this.isConfigured()) {
      this.logger.warn('GmailService not configured — sendNotification skipped');
      return { id: '', threadId: '' };
    }

    const subject = `New portfolio message from ${thread.name}`;
    const body = [
      'You received a new contact form submission on your portfolio.',
      '',
      `Name:    ${thread.name}`,
      `Email:   ${thread.email}`,
      `Subject: ${thread.subject ?? '(none)'}`,
      '',
      '──────────────────────────────────────────',
      bodyText,
      '──────────────────────────────────────────',
      '',
      'Reply to this email to respond directly to the visitor,',
      'or use the admin panel to send a tracked reply.',
    ].join('\n');

    const raw = this.buildRaw(
      {
        'MIME-Version': '1.0',
        From: this.gmailUser!,
        To: this.gmailUser!,
        'Reply-To': thread.email,
        Subject: subject,
      },
      body,
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
   * Send a reply from admin (GMAIL_USER) to the visitor.
   * Passes gmailThreadId so the message lands in the same Gmail thread AND in Sent.
   * In-Reply-To/References are not set here because we don't store the original Message-ID;
   * Gmail's threadId parameter is sufficient to keep the conversation grouped.
   */
  async sendReply(
    thread: Pick<ContactThread, 'name' | 'email' | 'subject' | 'gmailThreadId'>,
    bodyText: string,
  ): Promise<{ id: string }> {
    if (!this.isConfigured()) {
      this.logger.warn('GmailService not configured — sendReply skipped');
      return { id: '' };
    }

    const subject = `Re: ${thread.subject ?? 'your message'}`;

    const raw = this.buildRaw(
      {
        'MIME-Version': '1.0',
        From: this.gmailUser!,
        To: thread.email,
        Subject: subject,
      },
      bodyText,
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
        const fromHeader =
          headers.find((h) => h.name?.toLowerCase() === 'from')?.value ?? '';
        return {
          gmailMessageId: msg.id as string,
          fromEmail: this.extractEmail(fromHeader),
          bodyText: this.extractBody(msg.payload),
          internalDate: new Date(Number(msg.internalDate ?? Date.now())),
        };
      });
  }
}
