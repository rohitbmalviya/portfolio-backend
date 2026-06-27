import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PageType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';

@Injectable()
export class PagesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Public: list all published pages (no sections — lightweight) ─────────
  findAllPublic() {
    return this.prisma.page.findMany({
      where: { published: true },
      orderBy: { navOrder: 'asc' },
      select: {
        id: true,
        slug: true,
        title: true,
        type: true,
        metaTitle: true,
        metaDescription: true,
        ogImage: true,
        navLabel: true,
        navOrder: true,
        showInNav: true,
        published: true,
        isSystem: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // ── Admin: list ALL pages (lightweight — fields + section count, no section bodies) ─
  findAllAdmin() {
    return this.prisma.page.findMany({
      orderBy: { navOrder: 'asc' },
      select: {
        id: true,
        slug: true,
        title: true,
        type: true,
        published: true,
        isSystem: true,
        showInNav: true,
        navOrder: true,
        navLabel: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { sections: true } },
      },
    });
  }

  // ── Public: navigation items (showInNav=true, published=true, ordered by navOrder) ─
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
    return page;
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
    return page;
  }

  async findById(id: string) {
    const page = await this.prisma.page.findUnique({ where: { id } });
    if (!page) {
      throw new NotFoundException(`Page "${id}" not found.`);
    }
    return page;
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
    return page;
  }

  // ── Create ───────────────────────────────────────────────────────────────
  async create(dto: CreatePageDto) {
    try {
      return await this.prisma.page.create({
        data: { ...dto, type: dto.type ?? PageType.CUSTOM },
      });
    } catch (error) {
      this.handleUniqueViolation(error);
    }
  }

  // ── Update ───────────────────────────────────────────────────────────────
  async update(id: string, dto: UpdatePageDto) {
    await this.findById(id);

    try {
      return await this.prisma.page.update({ where: { id }, data: dto });
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
