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
import { BlogService } from './blog.service';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('blog')
@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  // ── GET /api/blog — public (published only) ──────────────────────────────
  @Get()
  @ApiOperation({ summary: 'List blog posts. Public: published, newest first. ?admin=true for all.' })
  @ApiQuery({ name: 'admin', required: false, type: Boolean })
  async findAll(@Query('admin') admin?: string) {
    const data =
      admin === 'true'
        ? await this.blogService.findAllAdmin()
        : await this.blogService.findAllPublic();
    return { data };
  }

  // ── GET /api/blog/id/:id — admin (look up by primary key) ────────────────
  @UseGuards(JwtAuthGuard)
  @Get('id/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Get a blog post by its ID' })
  async findOneById(@Param('id') id: string) {
    return { data: await this.blogService.findById(id) };
  }

  // ── GET /api/blog/:slug — public ─────────────────────────────────────────
  @Get(':slug')
  @ApiOperation({ summary: 'Get a blog post by slug. Pass ?admin=true for unpublished.' })
  @ApiQuery({ name: 'admin', required: false, type: Boolean })
  async findOne(
    @Param('slug') slug: string,
    @Query('admin') admin?: string,
  ) {
    const data =
      admin === 'true'
        ? await this.blogService.findBySlugAdmin(slug)
        : await this.blogService.findBySlugPublic(slug);
    return { data };
  }

  // ── POST /api/blog — admin ───────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Create a blog post' })
  async create(
    @Body() dto: CreateBlogPostDto,
    @CurrentUser() user: AdminUser,
  ) {
    return { data: await this.blogService.create(dto, user.id) };
  }

  // ── PATCH /api/blog/:id/publish — admin ──────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Patch(':id/publish')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Toggle blog post published status' })
  async togglePublished(
    @Param('id') id: string,
    @CurrentUser() user: AdminUser,
  ) {
    return { data: await this.blogService.togglePublished(id, user.id) };
  }

  // ── PATCH /api/blog/:id — admin ───────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Admin] Update a blog post by ID' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBlogPostDto,
    @CurrentUser() user: AdminUser,
  ) {
    return { data: await this.blogService.update(id, dto, user.id) };
  }

  // ── DELETE /api/blog/:id — admin ─────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Delete a blog post by ID' })
  async remove(@Param('id') id: string) {
    await this.blogService.remove(id);
  }
}
