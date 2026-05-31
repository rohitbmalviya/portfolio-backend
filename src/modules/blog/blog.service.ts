import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';

@Injectable()
export class BlogService {
  constructor(private readonly prisma: PrismaService) {}

  private async findOrThrow(id: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!post) {
      throw new NotFoundException(`Blog post "${id}" not found.`);
    }
    return post;
  }

  // ── Public: list published posts, newest first ────────────────────────
  findAllPublic() {
    return this.prisma.blogPost.findMany({
      where: { published: true },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        coverImage: true,
        tags: true,
        readingTime: true,
        published: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // ── Admin: list all posts ─────────────────────────────────────────────
  findAllAdmin() {
    return this.prisma.blogPost.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Public: single published post by slug ────────────────────────────
  async findBySlugPublic(slug: string) {
    const post = await this.prisma.blogPost.findFirst({
      where: { slug, published: true },
    });
    if (!post) {
      throw new NotFoundException(`Blog post "${slug}" not found.`);
    }
    return post;
  }

  // ── Admin: single post by slug ───────────────────────────────────────
  async findBySlugAdmin(slug: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { slug } });
    if (!post) {
      throw new NotFoundException(`Blog post "${slug}" not found.`);
    }
    return post;
  }

  // ── Create ───────────────────────────────────────────────────────────
  async create(dto: CreateBlogPostDto) {
    const existing = await this.prisma.blogPost.findUnique({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(`A blog post with slug "${dto.slug}" already exists.`);
    }
    return this.prisma.blogPost.create({
      data: {
        ...dto,
        tags: dto.tags ?? [],
        publishedAt: dto.published && dto.publishedAt
          ? new Date(dto.publishedAt)
          : dto.published
          ? new Date()
          : null,
      },
    });
  }

  // ── Update ───────────────────────────────────────────────────────────
  async update(id: string, dto: UpdateBlogPostDto) {
    const existing = await this.findOrThrow(id);

    if (dto.slug && dto.slug !== existing.slug) {
      const conflict = await this.prisma.blogPost.findFirst({
        where: { slug: dto.slug, NOT: { id } },
      });
      if (conflict) {
        throw new ConflictException(`A blog post with slug "${dto.slug}" already exists.`);
      }
    }

    const { publishedAt, ...rest } = dto;
    return this.prisma.blogPost.update({
      where: { id },
      data: {
        ...rest,
        ...(publishedAt !== undefined ? { publishedAt: new Date(publishedAt) } : {}),
      },
    });
  }

  // ── Publish toggle ────────────────────────────────────────────────────
  async togglePublished(id: string) {
    const post = await this.findOrThrow(id);
    return this.prisma.blogPost.update({
      where: { id },
      data: {
        published: !post.published,
        // Set publishedAt when publishing for the first time
        publishedAt: !post.published && !post.publishedAt ? new Date() : post.publishedAt,
      },
    });
  }

  // ── Delete ────────────────────────────────────────────────────────────
  async remove(id: string) {
    await this.findOrThrow(id);
    return this.prisma.blogPost.delete({ where: { id } });
  }
}
