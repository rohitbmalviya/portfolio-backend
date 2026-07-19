import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ContactThread } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GmailService, ReplySignature } from './gmail.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { SINGLETON_ID } from '../settings/settings.constants';
import {
  ContactDirection,
  ContactSource,
  SNIPPET_MAX_LENGTH,
  OWNER_DEFAULTS,
} from './contact.constants';

// ── Module-level helpers ──────────────────────────────────────────────────────

/**
 * Parse the `socials` JSON field from SiteSettings into discrete URL strings.
 *
 * Handles two shapes stored in the DB:
 *   • Object shape  — { github: string, linkedin: string, twitter?: string }
 *   • Array shape   — [{ type: string, url?: string, value?: string }, …]
 *
 * Falls back gracefully when either field is missing or the row doesn't exist.
 */
function extractSocialUrls(socials: unknown): { github: string; linkedin: string } {
  const fallback = {
    github: OWNER_DEFAULTS.github,
    linkedin: OWNER_DEFAULTS.linkedin,
  };

  if (!socials || typeof socials !== 'object') return fallback;

  // Array shape: [{type:'github', url:'...'}, {type:'linkedin', value:'...'}]
  if (Array.isArray(socials)) {
    const find = (type: string): string => {
      const item = (socials as Array<Record<string, unknown>>).find(
        (s) => typeof s?.type === 'string' && s.type.toLowerCase() === type,
      );
      if (!item) return '';
      // support both `url` and `value` property names
      return (
        (typeof item.url === 'string' ? item.url : '') ||
        (typeof item.value === 'string' ? item.value : '')
      );
    };
    return {
      github: find('github') || fallback.github,
      linkedin: find('linkedin') || fallback.linkedin,
    };
  }

  // Object shape: { github: '...', linkedin: '...' }
  const obj = socials as Record<string, unknown>;
  return {
    github: typeof obj.github === 'string' && obj.github ? obj.github : fallback.github,
    linkedin: typeof obj.linkedin === 'string' && obj.linkedin ? obj.linkedin : fallback.linkedin,
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gmail: GmailService,
  ) {}

  // ── Internal ──────────────────────────────────────────────────────────────

  private async findOrThrow(id: string): Promise<ContactThread> {
    const thread = await this.prisma.contactThread.findUnique({ where: { id } });
    if (!thread) throw new NotFoundException(`Contact thread "${id}" not found.`);
    return thread;
  }

  /**
   * Load SiteSettings and build a ReplySignature for outbound emails.
   * Falls back gracefully if the settings row is missing or the query fails.
   * Factored out so reply() and compose() share identical signature logic.
   */
  private async buildSignature(): Promise<ReplySignature> {
    try {
      const settings = await this.prisma.siteSettings.findUnique({
        where: { id: SINGLETON_ID },
      });

      const { github, linkedin } = extractSocialUrls(settings?.socials);

      return {
        name: settings?.name || OWNER_DEFAULTS.name,
        role: settings?.tagline || OWNER_DEFAULTS.role,
        email: settings?.email || process.env.GMAIL_USER || OWNER_DEFAULTS.email,
        portfolioUrl: process.env.SITE_URL ?? OWNER_DEFAULTS.portfolio,
        linkedinUrl: linkedin,
        githubUrl: github,
        brandAccent: settings?.brandAccent ?? OWNER_DEFAULTS.brandAccent,
      };
    } catch (err) {
      this.logger.warn(
        `buildSignature: failed to load SiteSettings — using fallbacks: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        name: OWNER_DEFAULTS.name,
        role: OWNER_DEFAULTS.role,
        email: process.env.GMAIL_USER ?? OWNER_DEFAULTS.email,
        portfolioUrl: process.env.SITE_URL ?? OWNER_DEFAULTS.portfolio,
        linkedinUrl: OWNER_DEFAULTS.linkedin,
        githubUrl: OWNER_DEFAULTS.github,
        brandAccent: OWNER_DEFAULTS.brandAccent,
      };
    }
  }

  // ── Public endpoint handler ───────────────────────────────────────────────

  /**
   * Called by the public contact form. Always saves the message; Gmail send is
   * best-effort — a failure never prevents the save.
   *
   * createdById/updatedById intentionally left NULL — this is a visitor action,
   * not an admin action.
   *
   * Honeypot: `website` is a hidden field real visitors never fill in. When a
   * bot fills it, we return the normal success response (so the bot doesn't
   * learn it was detected) but silently skip persisting or sending anything.
   */
  async createFromWeb(dto: CreateContactDto): Promise<{ success: true }> {
    if (dto.website && dto.website.trim().length > 0) {
      this.logger.warn('createFromWeb: honeypot field filled — silently dropping submission');
      return { success: true };
    }

    const { name, email, subject, message } = dto;

    // 1. Persist thread + initial inbound message in one round-trip
    const thread = await this.prisma.contactThread.create({
      data: {
        name,
        email,
        subject,
        unread: true,
        messages: {
          create: {
            direction: ContactDirection.Inbound,
            source: ContactSource.Web,
            body: message,
            // createdById: null — inbound visitor message
          },
        },
        // createdById: null — visitor-originated thread
      },
    });

    // 2. Send admin notification via Gmail (non-blocking, failure-safe)
    if (this.gmail.isConfigured()) {
      try {
        // Build signature to supply the admin name and brand colour for the notification email
        const signature = await this.buildSignature();
        const sent = await this.gmail.sendNotification(
          { name, email, subject: subject ?? null },
          message,
          signature.name,
          signature.brandAccent,
        );

        if (sent.id && sent.threadId) {
          // Store the Gmail thread reference on the DB thread for future sync
          await this.prisma.contactThread.update({
            where: { id: thread.id },
            data: { gmailThreadId: sent.threadId },
          });

          // Record the outgoing notification message for deduplication during sync
          // createdById: null — system-originated notification, not a direct admin action
          await this.prisma.contactMessage.create({
            data: {
              threadId: thread.id,
              direction: ContactDirection.Outbound,
              source: ContactSource.Notification,
              body: '[Admin notification email sent]',
              gmailMessageId: sent.id,
            },
          });
        }
      } catch (err) {
        this.logger.error(
          `Gmail notification failed for thread ${thread.id} — message saved`,
          err instanceof Error ? err.message : String(err),
        );
      }
    } else {
      this.logger.warn(
        'Gmail not configured — notification email skipped (contact message saved to DB)',
      );
    }

    return { success: true };
  }

  // ── Admin read operations ─────────────────────────────────────────────────

  /**
   * List all threads ordered by most recent activity.
   * Enriches each row with messageCount and a snippet of the latest message.
   */
  async listThreads() {
    const threads = await this.prisma.contactThread.findMany({
      orderBy: { lastMessageAt: 'desc' },
      include: {
        _count: { select: { messages: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { body: true },
        },
      },
    });

    return threads.map(({ messages, _count, ...rest }) => ({
      ...rest,
      messageCount: _count.messages,
      lastSnippet: this.snippetOf(messages[0]?.body ?? ''),
    }));
  }

  /**
   * Builds a clean one-line preview: strips quoted reply history
   * (the `On … wrote:` / `>` / `-----Original Message-----` block),
   * collapses whitespace, and truncates to SNIPPET_MAX_LENGTH chars.
   */
  private snippetOf(body: string): string {
    const text = (body ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = text.split('\n');
    let cut = lines.length;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const isQuote =
        line.startsWith('>') ||
        /^-{3,}\s*original message\s*-{3,}/i.test(line) ||
        /^_{5,}$/.test(line) ||
        /^on\b.*\bwrote:$/i.test(line) ||
        (/^on\b/i.test(line) && i + 1 < lines.length && /\bwrote:$/i.test(lines[i + 1].trim()));
      if (isQuote) {
        cut = i;
        break;
      }
    }
    let visible = lines.slice(0, cut).join('\n').trim();
    if (!visible) visible = text.trim(); // whole body was a quote — don't blank it
    return visible.replace(/\s+/g, ' ').trim().substring(0, SNIPPET_MAX_LENGTH);
  }

  /**
   * Get a single thread with all messages ordered chronologically.
   * Does NOT mark as read automatically — that is an explicit PATCH action.
   */
  async getThread(id: string) {
    const thread = await this.prisma.contactThread.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!thread) throw new NotFoundException(`Contact thread "${id}" not found.`);
    return thread;
  }

  /**
   * Mark a thread as read (unread = false) and, if linked to Gmail, remove the
   * UNREAD label there too.
   *
   * userId — admin id from the guarded controller; sets updatedById on the thread.
   */
  async markRead(id: string, userId?: string) {
    const thread = await this.findOrThrow(id);

    const updated = await this.prisma.contactThread.update({
      where: { id },
      data: {
        unread: false,
        ...(userId ? { updatedById: userId } : {}),
      },
    });

    // Best-effort: mirror the read state into Gmail so the inbox stays clean
    if (thread.gmailThreadId) {
      try {
        await this.gmail.markThreadRead(thread.gmailThreadId);
      } catch (err) {
        // markThreadRead never throws — this is an extra safety net
        this.logger.warn(
          `markRead: unexpected error mirroring to Gmail for thread ${id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return updated;
  }

  // ── Admin write operations ────────────────────────────────────────────────

  /**
   * Compose a brand-new outbound email from the admin to any recipient.
   *
   * 1. Creates a ContactThread (email=to, name=name||to, subject, unread=false).
   *    updatedById is set to the admin userId (admin is performing this action).
   * 2. Inserts an outbound ContactMessage with createdById=userId (admin authored it).
   * 3. Builds the branded signature from SiteSettings (same helper as reply).
   * 4. If Gmail is configured, sends via sendCompose and stores the Gmail IDs.
   *    A send failure is logged but never prevents the thread from being saved.
   * 5. Returns the thread with all messages — same shape as getThread.
   *
   * userId — admin id from the guarded controller.
   */
  async compose(
    dto: { to: string; name?: string; subject?: string; body: string },
    userId?: string,
  ) {
    const { to, name, subject, body } = dto;
    const threadName = name?.trim() || to;

    // 1 + 2. Persist thread and initial outbound message in one round-trip.
    // updatedById set on thread (admin action); createdById set on the message.
    const thread = await this.prisma.contactThread.create({
      data: {
        email: to,
        name: threadName,
        subject: subject || null,
        unread: false,
        ...(userId ? { updatedById: userId } : {}),
        messages: {
          create: {
            direction: ContactDirection.Outbound,
            source: ContactSource.App,
            body,
            ...(userId ? { createdById: userId } : {}),
          },
        },
      },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    // 3. Build email signature
    const signature = await this.buildSignature();

    // 4. Send via Gmail (best-effort — a failure never prevents the DB save)
    if (this.gmail.isConfigured()) {
      try {
        const sent = await this.gmail.sendCompose(to, subject ?? null, body, signature);

        if (sent.id && sent.threadId) {
          await this.prisma.contactThread.update({
            where: { id: thread.id },
            data: {
              gmailThreadId: sent.threadId,
              lastMessageAt: new Date(),
              ...(userId ? { updatedById: userId } : {}),
            },
          });

          await this.prisma.contactMessage.update({
            where: { id: thread.messages[0].id },
            data: { gmailMessageId: sent.id },
          });

          // Return a fresh read with the updated Gmail references
          return this.getThread(thread.id);
        }
      } catch (err) {
        this.logger.error(
          `compose: Gmail send failed for thread ${thread.id} — thread still saved to DB`,
          err instanceof Error ? err.message : String(err),
        );
      }
    } else {
      this.logger.warn('Gmail not configured — compose email skipped (thread saved to DB)');
    }

    // Return the thread as created (Gmail IDs absent when send was skipped/failed)
    return thread;
  }

  /**
   * Mark ALL threads as read and, for each one linked to a Gmail thread, best-effort
   * remove the UNREAD label in Gmail.  A single Gmail failure never aborts the rest.
   * Returns { updated } — count of rows that were actually changed.
   *
   * userId — admin id from the guarded controller; sets updatedById on all affected threads.
   */
  async markAllRead(userId?: string): Promise<{ updated: number }> {
    // Capture Gmail-linked unread threads BEFORE the bulk update so we know which to sync
    const threadsWithGmail = await this.prisma.contactThread.findMany({
      where: { unread: true, gmailThreadId: { not: null } },
      select: { gmailThreadId: true },
    });

    const result = await this.prisma.contactThread.updateMany({
      where: { unread: true },
      data: {
        unread: false,
        ...(userId ? { updatedById: userId } : {}),
      },
    });

    // Best-effort: mirror read state into Gmail for each linked thread
    for (const t of threadsWithGmail) {
      try {
        await this.gmail.markThreadRead(t.gmailThreadId as string);
      } catch (err) {
        // markThreadRead never throws — this is an extra outer safety net
        this.logger.warn(
          `markAllRead: unexpected error mirroring to Gmail for gmailThreadId ${t.gmailThreadId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return { updated: result.count };
  }

  /**
   * Send a reply from the admin.
   *
   * 1. Loads the singleton SiteSettings row to build a branded email signature.
   *    Falls back gracefully if the row doesn't exist or the query fails.
   * 2. Inserts a ContactMessage with createdById=userId (admin authored it).
   * 3. Bumps thread.updatedById=userId (admin action touched this thread).
   * 4. If Gmail is configured, the reply is sent to the visitor with the branded
   *    HTML template and linked to the existing Gmail thread via threadId.
   *
   * userId — admin id from the guarded controller.
   */
  async reply(id: string, body: string, userId?: string) {
    const thread = await this.findOrThrow(id);

    // ── Build email signature from SiteSettings (with full fallback) ─────────
    const signature = await this.buildSignature();

    // ── Try Gmail first so we can capture the gmailMessageId before persisting ──
    let gmailMessageId: string | undefined;

    if (this.gmail.isConfigured()) {
      try {
        const sent = await this.gmail.sendReply(thread, body, signature);
        if (sent.id) gmailMessageId = sent.id;
      } catch (err) {
        this.logger.error(
          `Gmail reply failed for thread ${thread.id} — reply still saved to DB`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    // ── Persist the reply message (with gmailMessageId when available) ────────
    // createdById = userId — admin authored this outbound message
    const message = await this.prisma.contactMessage.create({
      data: {
        threadId: thread.id,
        direction: ContactDirection.Outbound,
        source: ContactSource.App,
        body,
        gmailMessageId,
        ...(userId ? { createdById: userId } : {}),
      },
    });

    // Bump thread activity + mark read + set updatedById (admin action)
    await this.prisma.contactThread.update({
      where: { id: thread.id },
      data: {
        lastMessageAt: new Date(),
        unread: false,
        ...(userId ? { updatedById: userId } : {}),
      },
    });

    return message;
  }

  /** Delete a thread and all its messages (cascade). */
  async remove(id: string) {
    await this.findOrThrow(id);
    return this.prisma.contactThread.delete({ where: { id } });
  }

  /** Count of unread threads — used for the admin badge. */
  async unreadCount(): Promise<{ count: number }> {
    const count = await this.prisma.contactThread.count({
      where: { unread: true },
    });
    return { count };
  }

  // ── Gmail sync ────────────────────────────────────────────────────────────

  /**
   * Pull latest messages from Gmail for every thread that has a gmailThreadId.
   * New messages are inserted with strict deduplication on gmailMessageId.
   * Inbound (visitor) messages set unread:true and bump lastMessageAt.
   *
   * Called automatically by the cron task every 2 minutes and manually via
   * POST /api/contact/sync. Safe to call concurrently — each thread is
   * processed independently; one failure does not abort the rest.
   *
   * No userId param — this is a system/cron operation; createdById/updatedById
   * remain NULL for all rows created or touched by this method.
   */
  async syncAll(): Promise<{ synced: number; errors: number }> {
    if (!this.gmail.isConfigured()) {
      this.logger.warn('Gmail not configured — syncAll skipped');
      return { synced: 0, errors: 0 };
    }

    const threads = await this.prisma.contactThread.findMany({
      where: { gmailThreadId: { not: null } },
      select: { id: true, gmailThreadId: true },
    });

    const gmailUser = (process.env.GMAIL_USER ?? '').toLowerCase();
    let synced = 0;
    let errors = 0;

    for (const thread of threads) {
      try {
        // gmailThreadId is guaranteed non-null by the where filter above
        const gmailMessages = await this.gmail.fetchThreadMessages(thread.gmailThreadId as string);

        let hasNewInbound = false;
        let latestDate: Date | null = null;

        for (const msg of gmailMessages) {
          // Strict deduplication: skip if already stored
          const existing = await this.prisma.contactMessage.findUnique({
            where: { gmailMessageId: msg.gmailMessageId },
          });
          if (existing) continue;

          const isFromAdmin = msg.fromEmail.toLowerCase() === gmailUser;
          const direction = isFromAdmin ? ContactDirection.Outbound : ContactDirection.Inbound;

          // createdById intentionally null — Gmail-synced messages are not direct admin actions
          await this.prisma.contactMessage.create({
            data: {
              threadId: thread.id,
              direction,
              source: ContactSource.Gmail,
              body: msg.bodyText,
              gmailMessageId: msg.gmailMessageId,
              createdAt: msg.internalDate,
            },
          });

          synced++;

          if (!isFromAdmin) {
            hasNewInbound = true;
          }

          if (latestDate === null || msg.internalDate > latestDate) {
            latestDate = msg.internalDate;
          }
        }

        // Update thread metadata once per thread instead of per message.
        // updatedById intentionally null — cron-driven, no admin user.
        if (latestDate !== null) {
          await this.prisma.contactThread.update({
            where: { id: thread.id },
            data: {
              lastMessageAt: latestDate,
              ...(hasNewInbound ? { unread: true } : {}),
            },
          });
        }
      } catch (err) {
        errors++;
        this.logger.error(
          `syncAll: failed to sync thread ${thread.id}`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    this.logger.log(`syncAll complete — ${synced} new messages, ${errors} thread errors`);
    return { synced, errors };
  }
}
