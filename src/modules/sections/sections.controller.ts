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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminUser } from '@prisma/client';
import { SectionsService } from './sections.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { ReorderSectionsDto } from './dto/reorder-sections.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('sections')
@Controller('sections')
export class SectionsController {
  constructor(private readonly sectionsService: SectionsService) {}

  // ── GET /api/sections?pageId=xxx ─────────────────────────────────────────
  @Get()
  @ApiOperation({
    summary: 'List sections for a page. Admin can pass ?admin=true to include disabled.',
  })
  @ApiQuery({ name: 'pageId', required: true })
  @ApiQuery({ name: 'admin', required: false, type: Boolean })
  async findByPage(@Query('pageId') pageId: string, @Query('admin') admin?: string) {
    return { data: await this.sectionsService.findByPage(pageId, admin === 'true') };
  }

  // ── GET /api/sections/:id ────────────────────────────────────────────────
  @Get(':id')
  @ApiOperation({ summary: 'Get a single section by ID' })
  async findOne(@Param('id') id: string) {
    return { data: await this.sectionsService.findOne(id) };
  }

  // ── POST /api/sections — admin ───────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Create a section on a page' })
  async create(@Body() dto: CreateSectionDto, @CurrentUser() user: AdminUser) {
    return { data: await this.sectionsService.create(dto, user.id) };
  }

  // ── PATCH /api/sections/reorder — BEFORE :id to avoid conflict ──────────
  @UseGuards(JwtAuthGuard)
  @Patch('reorder')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Reorder sections (batch update order values)' })
  async reorder(@Body() dto: ReorderSectionsDto, @CurrentUser() user: AdminUser) {
    return { data: await this.sectionsService.reorder(dto, user.id) };
  }

  // ── PATCH /api/sections/:id/toggle ──────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Patch(':id/toggle')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Toggle section enabled/disabled' })
  async toggleEnabled(@Param('id') id: string, @CurrentUser() user: AdminUser) {
    return { data: await this.sectionsService.toggleEnabled(id, user.id) };
  }

  // ── PATCH /api/sections/:id ──────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Update a section by ID' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSectionDto,
    @CurrentUser() user: AdminUser,
  ) {
    return { data: await this.sectionsService.update(id, dto, user.id) };
  }

  // ── DELETE /api/sections/:id — admin ────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Delete a section by ID' })
  async remove(@Param('id') id: string) {
    await this.sectionsService.remove(id);
  }
}
