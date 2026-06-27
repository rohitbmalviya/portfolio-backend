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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PagesService } from './pages.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('pages')
@Controller('pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  // ── GET /api/pages — public (published only) or admin (all) ─────────────
  @Get()
  @ApiOperation({ summary: 'List pages. Pass ?admin=true (with JWT) to get all incl. unpublished.' })
  @ApiQuery({ name: 'admin', required: false, type: Boolean })
  async findAll(@Query('admin') admin?: string) {
    if (admin === 'true') {
      return { data: await this.pagesService.findAllAdmin() };
    }
    return { data: await this.pagesService.findAllPublic() };
  }

  // ── GET /api/pages/id/:id — admin (look up by primary key) ─────────────────
  // Must be declared BEFORE :slug to avoid Express treating "id" as a slug value.
  @UseGuards(JwtAuthGuard)
  @Get('id/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Get a page by its ID with all sections (incl. disabled)' })
  async findOneById(@Param('id') id: string) {
    return { data: await this.pagesService.findByIdWithSections(id) };
  }

  // ── GET /api/pages/nav — public navigation items ────────────────────────
  // IMPORTANT: must be declared before @Get(':slug') so Express does not
  // treat the literal string "nav" as a slug parameter.
  @Get('nav')
  @ApiOperation({
    summary: 'Public nav items — pages with showInNav=true and published=true, ordered by navOrder',
  })
  async findNav() {
    return { data: await this.pagesService.findNav() };
  }

  // ── GET /api/pages/:slug — public (enabled sections) or admin (all sections) ─
  @Get(':slug')
  @ApiOperation({ summary: 'Get a page by slug with its sections. Pass ?admin=true for all sections.' })
  @ApiQuery({ name: 'admin', required: false, type: Boolean })
  async findOne(@Param('slug') slug: string, @Query('admin') admin?: string) {
    if (admin === 'true') {
      return { data: await this.pagesService.findBySlugAdmin(slug) };
    }
    return { data: await this.pagesService.findBySlugPublic(slug) };
  }

  // ── POST /api/pages — admin ──────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Create a new page' })
  async create(@Body() dto: CreatePageDto) {
    return { data: await this.pagesService.create(dto) };
  }

  // ── PATCH /api/pages/:id — admin ─────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Update a page by ID' })
  async update(@Param('id') id: string, @Body() dto: UpdatePageDto) {
    return { data: await this.pagesService.update(id, dto) };
  }

  // ── DELETE /api/pages/:id — admin ────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Delete a page by ID (page must have zero sections)' })
  async remove(@Param('id') id: string) {
    await this.pagesService.remove(id);
  }
}
