import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContactService } from './contact.service';
import { ComposeContactDto } from './dto/compose-contact.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { ReplyContactDto } from './dto/reply-contact.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  // ── PUBLIC — contact form submission ─────────────────────────────────────
  // No guard: any visitor can submit the form.

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

  @UseGuards(JwtAuthGuard)
  @Post('sync')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Manually trigger Gmail thread sync' })
  async sync() {
    return { data: await this.contactService.syncAll() };
  }

  // Declared BEFORE threads/:id so Express does not treat "compose" as an id.
  @UseGuards(JwtAuthGuard)
  @Post('compose')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Compose a new outbound email thread to any recipient' })
  async compose(@Body() dto: ComposeContactDto) {
    return { data: await this.contactService.compose(dto) };
  }

  // Declared BEFORE threads/:id so Express does not treat "read-all" as an id.
  @UseGuards(JwtAuthGuard)
  @Patch('read-all')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Mark all contact threads as read' })
  async markAllRead() {
    return { data: await this.contactService.markAllRead() };
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
  async markRead(@Param('id') id: string) {
    return { data: await this.contactService.markRead(id) };
  }

  @UseGuards(JwtAuthGuard)
  @Post('threads/:id/reply')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Send a reply to a contact thread' })
  async reply(@Param('id') id: string, @Body() dto: ReplyContactDto) {
    return { data: await this.contactService.reply(id, dto.body) };
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
