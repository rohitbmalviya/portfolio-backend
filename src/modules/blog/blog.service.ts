import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { BlogPost, Media, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';

// ── Response shape helper ─────────────────────────────────────────────────────
// Identical output keys to the previous include-based approach.
function mapBlogPost(post: BlogPost, media: Media[]) {
  const mappedImages = media.map((m) => ({
    mediaId: m.id,
    url: m.cloudinaryUrl,
    alt: m.alt,
  }));
  return {
    ...post,
    images: mappedImages,
    // First image acts as the cover for list cards
    coverImage: mappedImages[0]?.url ?? null,
  };
}

// ── Batch-group media by ownerId (avoids N+1 in list reads) ──────────────────
function groupByOwnerId(media: Media[]): Map<string, Media[]> {
  const map = new Map<string, Media[]>();
  for (const m of media) {
    if (!m.ownerId) continue;
    const list = map.get(m.ownerId) ?? [];
    list.push(m);
    map.set(m.ownerId, list);
  }
  return map;
}

@Injectable()
export class BlogService {
  constructor(private readonly prisma: PrismaService) {}

  private async findOrThrow(id: string): Promise<BlogPost> {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!post) {
      throw new NotFoundException(`Blog post "${id}" not found.`);
    }
    return post;
  }

  // ── Public: list published posts, newest first ────────────────────────
  async findAllPublic() {
    const posts = await this.prisma.blogPost.findMany({
      where: { published: true },
      orderBy: { publishedAt: 'desc' },
    });

    if (posts.length === 0) return [];

    // Batch media fetch — one query for all posts
    const ids = posts.map((p) => p.id);
    const allMedia = await this.prisma.media.findMany({
      where: { ownerType: 'blog', ownerId: { in: ids } },
      orderBy: { order: 'asc' },
    });
    const mediaByOwner = groupByOwnerId(allMedia);

    return posts.map((p) => mapBlogPost(p, mediaByOwner.get(p.id) ?? []));
  }

  // ── Admin: single post by ID (any status) ─────────────────────────────
  async findById(id: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!post) {
      throw new NotFoundException(`Blog post "${id}" not found.`);
    }
    const media = await this.prisma.media.findMany({
      where: { ownerType: 'blog', ownerId: id },
      orderBy: { order: 'asc' },
    });
    return mapBlogPost(post, media);
  }

  // ── Admin: list all posts (trimmed to the fields the list UI needs) ────
  findAllAdmin() {
    return this.prisma.blogPost.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        published: true,
        publishedAt: true,
        readingTime: true,
        createdAt: true,
      },
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
    const media = await this.prisma.media.findMany({
      where: { ownerType: 'blog', ownerId: post.id },
      orderBy: { order: 'asc' },
    });
    return mapBlogPost(post, media);
  }

  // ── Admin: single post by slug ───────────────────────────────────────
  async findBySlugAdmin(slug: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { slug } });
    if (!post) {
      throw new NotFoundException(`Blog post "${slug}" not found.`);
    }
    const media = await this.prisma.media.findMany({
      where: { ownerType: 'blog', ownerId: post.id },
      orderBy: { order: 'asc' },
    });
    return mapBlogPost(post, media);
  }

  // ── Create ───────────────────────────────────────────────────────────
  async create(dto: CreateBlogPostDto, userId: string) {
    // Friendlier pre-check message (best-effort — the P2002 catch below is
    // the actual guarantee against the TOCTOU race between this check and
    // the insert).
    const existing = await this.prisma.blogPost.findUnique({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(`A blog post with slug "${dto.slug}" already exists.`);
    }

    const { publishedAt, ...rest } = dto;

    try {
      const post = await this.prisma.blogPost.create({
        data: {
          ...rest,
          tags: rest.tags ?? [],
          createdById: userId,
          publishedAt:
            rest.published && publishedAt
              ? new Date(publishedAt)
              : rest.published
                ? new Date()
                : null,
        },
      });

      // Newly created — no media linked yet (deferred-upload flow)
      return mapBlogPost(post, []);
    } catch (error) {
      this.handleUniqueViolation(error, dto.slug);
    }
  }

  // ── Update ───────────────────────────────────────────────────────────
  async update(id: string, dto: UpdateBlogPostDto, userId?: string) {
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

    let post: BlogPost;
    try {
      post = await this.prisma.blogPost.update({
        where: { id },
        data: {
          ...rest,
          ...(publishedAt !== undefined ? { publishedAt: new Date(publishedAt) } : {}),
          ...(userId ? { updatedById: userId } : {}),
        },
      });
    } catch (error) {
      this.handleUniqueViolation(error, dto.slug);
    }

    const media = await this.prisma.media.findMany({
      where: { ownerType: 'blog', ownerId: id },
      orderBy: { order: 'asc' },
    });
    return mapBlogPost(post, media);
  }

  // ── Shared P2002 handler ───────────────────────────────────────────────
  private handleUniqueViolation(error: unknown, slug?: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(
        slug
          ? `A blog post with slug "${slug}" already exists.`
          : 'A blog post with this value already exists.',
      );
    }
    throw error;
  }

  // ── Publish toggle ────────────────────────────────────────────────────
  async togglePublished(id: string, userId?: string) {
    const post = await this.findOrThrow(id);
    const updated = await this.prisma.blogPost.update({
      where: { id },
      data: {
        published: !post.published,
        publishedAt: !post.published && !post.publishedAt ? new Date() : post.publishedAt,
        ...(userId ? { updatedById: userId } : {}),
      },
    });
    const media = await this.prisma.media.findMany({
      where: { ownerType: 'blog', ownerId: id },
      orderBy: { order: 'asc' },
    });
    return mapBlogPost(updated, media);
  }

  // ── Delete ────────────────────────────────────────────────────────────
  async remove(id: string) {
    await this.findOrThrow(id);
    return this.prisma.blogPost.delete({ where: { id } });
  }
}
