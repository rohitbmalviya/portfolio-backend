import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { ContactSyncTask } from './contact.sync.task';
import { GmailService } from './gmail.service';

@Module({
  imports: [AuthModule],
  controllers: [ContactController],
  providers: [ContactService, GmailService, ContactSyncTask],
})
export class ContactModule {}
