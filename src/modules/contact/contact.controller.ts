import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminUser } from '@prisma/client';
import { ContactService } from './contact.service';
import { ComposeContactDto } from './dto/compose-contact.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { ReplyContactDto } from './dto/reply-contact.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  // ── PUBLIC — contact form submission ─────────────────────────────────────
  // No guard: any visitor can submit the form.
  // createdById/updatedById remain NULL — visitor action, not admin.

  // Stricter than the global 120/min throttle — spam protection for the
  // public form: 5 submissions per 15 minutes per IP.
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @Post()
  @ApiOperation({ summary: 'Submit a contact form message (public)' })
  async create(@Body() dto: CreateContactDto) {
    return { data: await this.contactService.createFromWeb(dto) };
  }

  // ── ADMIN — static routes MUST be declared before parameterised :id routes ──

  @UseGuards(JwtAuthGuard)
  @Get('threads')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] List all contact threads (newest first)' })
  async listThreads() {
    return { data: await this.contactService.listThreads() };
  }

  // Declared BEFORE threads/:id so Express does not treat "unread-count" as an id.
  @UseGuards(JwtAuthGuard)
  @Get('unread-count')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Count of unread contact threads' })
  async unreadCount() {
    return { data: await this.contactService.unreadCount() };
  }

  // syncAll is called from both this endpoint and the cron task.
  // The cron has no user, so syncAll never accepts a userId — audit columns
  // remain NULL for all Gmail-synced messages regardless of how sync was triggered.
  @UseGuards(JwtAuthGuard)
  @Post('sync')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Manually trigger Gmail thread sync' })
  async sync() {
    return { data: await this.contactService.syncAll() };
  }

  // ── CLOUD SCHEDULER — shared-secret sync (no JWT) ────────────────────────
  //
  // Cloud Run scales to zero and throttles CPU between requests, so the
  // in-process @nestjs/schedule cron (ContactSyncTask) cannot be relied on
  // to fire on schedule there. Cloud Scheduler instead calls this endpoint
  // on a fixed interval (see DEPLOYMENT.md). It runs the exact same
  // ContactService.syncAll() as the guarded /sync route above, but is
  // authenticated with a shared secret header instead of a JWT, since
  // Cloud Scheduler has no admin session.
  //
  // Deliberately fails closed: an unset CRON_SECRET must NOT mean "open
  // access" — both a missing/mismatched header AND a missing env var
  // result in 401, and syncAll() is never called in either case.
  //
  // No @Throttle override here: the global limit (120 req/60s per IP) is
  // far above a "every few minutes" Cloud Scheduler call.
  @Post('sync-cron')
  @ApiOperation({
    summary: '[Cloud Scheduler] Trigger Gmail thread sync via shared-secret header (no JWT)',
  })
  async syncCron(@Headers('x-cron-secret') cronSecret?: string) {
    const expected = process.env['CRON_SECRET'];
    if (!expected || cronSecret !== expected) {
      throw new UnauthorizedException();
    }
    return { data: await this.contactService.syncAll() };
  }

  // Declared BEFORE threads/:id so Express does not treat "compose" as an id.
  @UseGuards(JwtAuthGuard)
  @Post('compose')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Compose a new outbound email thread to any recipient' })
  async compose(@Body() dto: ComposeContactDto, @CurrentUser() user: AdminUser) {
    return { data: await this.contactService.compose(dto, user.id) };
  }

  // Declared BEFORE threads/:id so Express does not treat "read-all" as an id.
  @UseGuards(JwtAuthGuard)
  @Patch('read-all')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Mark all contact threads as read' })
  async markAllRead(@CurrentUser() user: AdminUser) {
    return { data: await this.contactService.markAllRead(user.id) };
  }

  // ── ADMIN — parameterised routes ─────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('threads/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Get a contact thread with all messages' })
  async getThread(@Param('id') id: string) {
    return { data: await this.contactService.getThread(id) };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('threads/:id/read')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Mark a thread as read' })
  async markRead(@Param('id') id: string, @CurrentUser() user: AdminUser) {
    return { data: await this.contactService.markRead(id, user.id) };
  }

  @UseGuards(JwtAuthGuard)
  @Post('threads/:id/reply')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Send a reply to a contact thread' })
  async reply(
    @Param('id') id: string,
    @Body() dto: ReplyContactDto,
    @CurrentUser() user: AdminUser,
  ) {
    return { data: await this.contactService.reply(id, dto.body, user.id) };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('threads/:id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Delete a contact thread and all its messages' })
  async remove(@Param('id') id: string) {
    await this.contactService.remove(id);
  }
}
