import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { GmailService } from './gmail.service';
import { ContactService } from './contact.service';

/**
 * ContactSyncTask — polls Gmail every 2 minutes to surface visitor replies
 * and admin Gmail replies that were sent outside the app.
 *
 * The cron guard checks isConfigured() so the job is silently skipped when
 * the Gmail env vars are not set.
 */
@Injectable()
export class ContactSyncTask {
  private readonly logger = new Logger(ContactSyncTask.name);

  constructor(
    private readonly contactService: ContactService,
    private readonly gmail: GmailService,
  ) {}

  @Cron('*/2 * * * *')
  async handleSync(): Promise<void> {
    if (!this.gmail.isConfigured()) return;

    this.logger.debug('Gmail sync triggered by cron');
    const result = await this.contactService.syncAll();
    if (result.synced > 0 || result.errors > 0) {
      this.logger.log(`Cron sync: ${result.synced} new messages, ${result.errors} errors`);
    }
  }
}
