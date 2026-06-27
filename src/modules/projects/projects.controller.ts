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
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ReorderProjectsDto } from './dto/reorder-projects.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // ── GET /api/projects — public (published only) ──────────────────────────
  @Get()
  @ApiOperation({ summary: 'List projects. Public: published only. ?featured=true to filter featured.' })
  @ApiQuery({ name: 'featured', required: false, type: Boolean })
  @ApiQuery({ name: 'admin', required: false, type: Boolean })
  async findAll(
    @Query('featured') featured?: string,
    @Query('admin') admin?: string,
  ) {
    const isFeatured = featured === 'true' ? true : undefined;
    const data =
      admin === 'true'
        ? await this.projectsService.findAllAdmin(isFeatured)
        : await this.projectsService.findAllPublic(isFeatured);
    return { data };
  }

  // ── GET /api/projects/id/:id — admin (look up by primary key) ────────────
  // Must be declared BEFORE :slug so Express doesn't treat "id" as a slug.
  @UseGuards(JwtAuthGuard)
  @Get('id/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Get a project by its ID' })
  async findOneById(@Param('id') id: string) {
    return { data: await this.projectsService.findById(id) };
  }

  // ── GET /api/projects/:slug — public ────────────────────────────────────
  @Get(':slug')
  @ApiOperation({ summary: 'Get a project by slug. Pass ?admin=true for unpublished.' })
  @ApiQuery({ name: 'admin', required: false, type: Boolean })
  async findOne(
    @Param('slug') slug: string,
    @Query('admin') admin?: string,
  ) {
    const data =
      admin === 'true'
        ? await this.projectsService.findBySlugAdmin(slug)
        : await this.projectsService.findBySlugPublic(slug);
    return { data };
  }

  // ── POST /api/projects — admin ───────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Create a project' })
  async create(@Body() dto: CreateProjectDto) {
    return { data: await this.projectsService.create(dto) };
  }

  // ── PATCH /api/projects/reorder — BEFORE :slug ──────────────────────────
  @UseGuards(JwtAuthGuard)
  @Patch('reorder')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Reorder projects' })
  async reorder(@Body() dto: ReorderProjectsDto) {
    return { data: await this.projectsService.reorder(dto) };
  }

  // ── PATCH /api/projects/:id/feature ─────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Patch(':id/feature')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Toggle project featured status' })
  async toggleFeatured(@Param('id') id: string) {
    return { data: await this.projectsService.toggleFeatured(id) };
  }

  // ── PATCH /api/projects/:id/publish ─────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Patch(':id/publish')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Toggle project published status' })
  async togglePublished(@Param('id') id: string) {
    return { data: await this.projectsService.togglePublished(id) };
  }

  // ── PATCH /api/projects/:id ──────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Update a project by ID' })
  async update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return { data: await this.projectsService.update(id, dto) };
  }

  // ── DELETE /api/projects/:id — admin ─────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Delete a project by ID' })
  async remove(@Param('id') id: string) {
    await this.projectsService.remove(id);
  }
}
