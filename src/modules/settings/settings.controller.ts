import {
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ── GET /api/settings — public ───────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'Get site settings (singleton)' })
  async getSettings() {
    return { data: await this.settingsService.getSettings() };
  }

  // ── PATCH /api/settings — admin ──────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Patch()
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Upsert site settings (singleton)' })
  async upsertSettings(@Body() dto: UpdateSettingsDto) {
    return { data: await this.settingsService.upsertSettings(dto) };
  }
}
