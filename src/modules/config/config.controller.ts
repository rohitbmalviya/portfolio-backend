import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminUser } from '@prisma/client';
import { ConfigService } from './config.service';
import { UpdateConfigDto } from './dto/update-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('config')
@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  // ── GET /api/config — public: all admin-editable option sets ─────────────
  @Get()
  @ApiOperation({ summary: 'List all admin-editable option sets' })
  async findAll() {
    return { data: await this.configService.findAll() };
  }

  // ── GET /api/config/enums — public: read-only schema enums ───────────────
  // Declared BEFORE :key so "enums" isn't treated as a key.
  @Get('enums')
  @ApiOperation({ summary: 'Code-defined schema enums (read-only)' })
  getEnums() {
    return { data: this.configService.getEnums() };
  }

  // ── GET /api/config/:key — public ────────────────────────────────────────
  @Get(':key')
  @ApiOperation({ summary: 'Get one option set by key' })
  async findByKey(@Param('key') key: string) {
    return { data: await this.configService.findByKey(key) };
  }

  // ── PATCH /api/config/:key — admin (upsert items) ────────────────────────
  @UseGuards(JwtAuthGuard)
  @Patch(':key')
  @ApiBearerAuth()
  @ApiOperation({ summary: "[Admin] Update an option set's items" })
  async update(
    @Param('key') key: string,
    @Body() dto: UpdateConfigDto,
    @CurrentUser() user: AdminUser,
  ) {
    return { data: await this.configService.update(key, dto, user.id) };
  }
}
