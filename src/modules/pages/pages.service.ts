import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Media, Page, Prisma, Section } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { attachGalleryImages } from '../../common/utils/gallery.util';

// ── Response shape helpers ────────────────────────────────────────────────────
// Returns the SAME keys as before: `ogImage` (URL) and `ogImageMediaId` (id).

function mapPage(page: Page, media: Media[]) {
  const ogMedia = media[0] ?? null;
  return {
    ...page,
    ogImage: ogMedia?.cloudinaryUrl ?? null,
    ogImageMediaId: ogMedia?.id ?? null,
  };
}

function mapPageWithSections(
  page: Page & { sections: Section[] },
  media: Media[],
) {
  const ogMedia = media[0] ?? null;
  return {
    ...page,
    ogImage: ogMedia?.cloudinaryUrl ?? null,
    ogImageMediaId: ogMedia?.id ?? null,
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
export class PagesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Public: list all published pages (no sections — lightweight) ─────────
  async findAllPublic() {
    const pages = await this.prisma.page.findMany({
      where: { published: true },
      orderBy: { navOrder: 'asc' },
    });

    if (pages.length === 0) return [];

    const ids = pages.map((p) => p.id);
    const allMedia = await this.prisma.media.findMany({
      where: { ownerType: 'page', ownerId: { in: ids } },
      orderBy: { order: 'asc' },
    });
    const mediaByOwner = groupByOwnerId(allMedia);

    return pages.map((p) => mapPage(p, mediaByOwner.get(p.id) ?? []));
  }

  // ── Admin: list ALL pages (lightweight — section count, no section bodies) ─
  async findAllAdmin() {
    const pages = await this.prisma.page.findMany({
      orderBy: { navOrder: 'asc' },
      include: {
        _count: { select: { sections: true } },
      },
    });

    if (pages.length === 0) return [];

    const ids = pages.map((p) => p.id);
    const allMedia = await this.prisma.media.findMany({
      where: { ownerType: 'page', ownerId: { in: ids } },
      orderBy: { order: 'asc' },
    });
    const mediaByOwner = groupByOwnerId(allMedia);

    return pages.map((page) => {
      const media = mediaByOwner.get(page.id) ?? [];
      const ogMedia = media[0] ?? null;
      return {
        ...page,
        ogImage: ogMedia?.cloudinaryUrl ?? null,
        ogImageMediaId: ogMedia?.id ?? null,
      };
    });
  }

  // ── Public: navigation items (showInNav=true, published=true) ────────────
  findNav() {
    return this.prisma.page.findMany({
      where: { showInNav: true, published: true },
      orderBy: { navOrder: 'asc' },
      select: {
        slug: true,
        title: true,
        navLabel: true,
        navOrder: true,
      },
    });
  }

  // ── Public: single page with ordered, enabled sections ──────────────────
  async findBySlugPublic(slug: string) {
    const page = await this.prisma.page.findFirst({
      where: { slug, published: true },
      include: {
        sections: {
          where: { enabled: true },
          orderBy: { order: 'asc' },
        },
      },
    });
    if (!page) {
      throw new NotFoundException(`Page "${slug}" not found.`);
    }
    // Fetch OG image and enrich GALLERY sections in parallel (single extra query each)
    const [ogMedia, enrichedSections] = await Promise.all([
      this.prisma.media.findMany({
        where: { ownerType: 'page', ownerId: page.id },
        orderBy: { order: 'asc' },
      }),
      attachGalleryImages(this.prisma, page.sections),
    ]);
    return mapPageWithSections({ ...page, sections: enrichedSections }, ogMedia);
  }

  // ── Admin: single page with ALL sections (incl. disabled) ───────────────
  async findBySlugAdmin(slug: string) {
    const page = await this.prisma.page.findFirst({
      where: { slug },
      include: {
        sections: {
          orderBy: { order: 'asc' },
        },
      },
    });
    if (!page) {
      throw new NotFoundException(`Page "${slug}" not found.`);
    }
    const [ogMedia, enrichedSections] = await Promise.all([
      this.prisma.media.findMany({
        where: { ownerType: 'page', ownerId: page.id },
        orderBy: { order: 'asc' },
      }),
      attachGalleryImages(this.prisma, page.sections),
    ]);
    return mapPageWithSections({ ...page, sections: enrichedSections }, ogMedia);
  }

  async findById(id: string) {
    const page = await this.prisma.page.findUnique({ where: { id } });
    if (!page) {
      throw new NotFoundException(`Page "${id}" not found.`);
    }
    const media = await this.prisma.media.findMany({
      where: { ownerType: 'page', ownerId: id },
      orderBy: { order: 'asc' },
    });
    return mapPage(page, media);
  }

  // ── Admin: single page by ID with ALL sections ───────────────────────────
  async findByIdWithSections(id: string) {
    const page = await this.prisma.page.findUnique({
      where: { id },
      include: {
        sections: {
          orderBy: { order: 'asc' },
        },
      },
    });
    if (!page) {
      throw new NotFoundException(`Page "${id}" not found.`);
    }
    const [ogMedia, enrichedSections] = await Promise.all([
      this.prisma.media.findMany({
        where: { ownerType: 'page', ownerId: id },
        orderBy: { order: 'asc' },
      }),
      attachGalleryImages(this.prisma, page.sections),
    ]);
    return mapPageWithSections({ ...page, sections: enrichedSections }, ogMedia);
  }

  // ── Create ───────────────────────────────────────────────────────────────
  async create(dto: CreatePageDto, userId: string) {
    try {
      const page = await this.prisma.page.create({
        data: { ...dto, createdById: userId },
      });
      // Newly created — no media linked yet (deferred-upload flow)
      return mapPage(page, []);
    } catch (error) {
      this.handleUniqueViolation(error);
    }
  }

  // ── Update ───────────────────────────────────────────────────────────────
  async update(id: string, dto: UpdatePageDto, userId?: string) {
    await this.findById(id);
    // UpdatePageDto has a legacy `ogImage` URL-only field (never mapped to a column).
    // Strip it so TypeScript is satisfied with the Prisma update input type.
    const { ogImage: _ogImage, ...pageData } = dto;
    try {
      const page = await this.prisma.page.update({
        where: { id },
        data: { ...pageData, ...(userId ? { updatedById: userId } : {}) },
      });
      const media = await this.prisma.media.findMany({
        where: { ownerType: 'page', ownerId: id },
        orderBy: { order: 'asc' },
      });
      return mapPage(page, media);
    } catch (error) {
      this.handleUniqueViolation(error);
    }
  }

  // ── Shared P2002 handler ─────────────────────────────────────────────────
  private handleUniqueViolation(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const field = (error.meta?.target as string[] | undefined)?.[0];
      if (field === 'slug') {
        throw new ConflictException('A page with this slug already exists.');
      }
      if (field === 'title') {
        throw new ConflictException('A page with this title already exists.');
      }
      throw new ConflictException('A page with this value already exists.');
    }
    throw error;
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  async remove(id: string) {
    await this.findById(id);

    const sectionCount = await this.prisma.section.count({ where: { pageId: id } });
    if (sectionCount > 0) {
      throw new ConflictException(
        'Cannot delete a page while it has sections. Remove all sections first.',
      );
    }

    return this.prisma.page.delete({ where: { id } });
  }
}
