import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ContactThread } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GmailService } from './gmail.service';
import { CreateContactDto } from './dto/create-contact.dto';

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

  // ── Public endpoint handler ───────────────────────────────────────────────

  /**
   * Called by the public contact form. Always saves the message; Gmail send is
   * best-effort — a failure never prevents the save.
   */
  async createFromWeb(dto: CreateContactDto): Promise<{ success: true }> {
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
            direction: 'inbound',
            source: 'web',
            body: message,
          },
        },
      },
    });

    // 2. Send admin notification via Gmail (non-blocking, failure-safe)
    if (this.gmail.isConfigured()) {
      try {
        const sent = await this.gmail.sendNotification({ name, email, subject: subject ?? null }, message);

        if (sent.id && sent.threadId) {
          // Store the Gmail thread reference on the DB thread for future sync
          await this.prisma.contactThread.update({
            where: { id: thread.id },
            data: { gmailThreadId: sent.threadId },
          });

          // Record the outgoing notification message for deduplication during sync
          await this.prisma.contactMessage.create({
            data: {
              threadId: thread.id,
              direction: 'outbound',
              source: 'notification',
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
   * Enriches each row with messageCount and a 120-char snippet of the latest message.
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
      lastSnippet: (messages[0]?.body ?? '').substring(0, 120),
    }));
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

  /** Mark a thread as read (unread = false). */
  async markRead(id: string) {
    await this.findOrThrow(id);
    return this.prisma.contactThread.update({
      where: { id },
      data: { unread: false },
    });
  }

  // ── Admin write operations ────────────────────────────────────────────────

  /**
   * Send a reply from the admin.
   * Inserts a ContactMessage immediately; Gmail send is best-effort.
   * If Gmail is configured, the reply is sent to the visitor AND linked
   * to the existing Gmail thread via threadId so it appears in Sent.
   */
  async reply(id: string, body: string) {
    const thread = await this.findOrThrow(id);

    // Try Gmail first so we can capture the gmailMessageId before persisting
    let gmailMessageId: string | undefined;

    if (this.gmail.isConfigured()) {
      try {
        const sent = await this.gmail.sendReply(thread, body);
        if (sent.id) gmailMessageId = sent.id;
      } catch (err) {
        this.logger.error(
          `Gmail reply failed for thread ${thread.id} — reply still saved to DB`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    // Persist the reply message (with gmailMessageId when available)
    const message = await this.prisma.contactMessage.create({
      data: {
        threadId: thread.id,
        direction: 'outbound',
        source: 'app',
        body,
        gmailMessageId,
      },
    });

    // Bump thread activity + mark read
    await this.prisma.contactThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: new Date(), unread: false },
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
        const gmailMessages = await this.gmail.fetchThreadMessages(
          thread.gmailThreadId as string,
        );

        let hasNewInbound = false;
        let latestDate: Date | null = null;

        for (const msg of gmailMessages) {
          // Strict deduplication: skip if already stored
          const existing = await this.prisma.contactMessage.findUnique({
            where: { gmailMessageId: msg.gmailMessageId },
          });
          if (existing) continue;

          const isFromAdmin = msg.fromEmail.toLowerCase() === gmailUser;
          const direction = isFromAdmin ? 'outbound' : 'inbound';

          await this.prisma.contactMessage.create({
            data: {
              threadId: thread.id,
              direction,
              source: 'gmail',
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

        // Update thread metadata once per thread instead of per message
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
