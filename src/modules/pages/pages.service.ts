import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
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

  // ── Admin: list ALL pages (with sections to support the section count display) ─
  findAllAdmin() {
    return this.prisma.page.findMany({
      orderBy: { navOrder: 'asc' },
      include: {
        sections: {
          orderBy: { order: 'asc' },
        },
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
    const existing = await this.prisma.page.findUnique({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(`A page with slug "${dto.slug}" already exists.`);
    }
    return this.prisma.page.create({ data: dto });
  }

  // ── Update ───────────────────────────────────────────────────────────────
  async update(id: string, dto: UpdatePageDto) {
    await this.findById(id);

    // If slug is changing, check uniqueness
    if (dto.slug) {
      const conflict = await this.prisma.page.findFirst({
        where: { slug: dto.slug, NOT: { id } },
      });
      if (conflict) {
        throw new ConflictException(`A page with slug "${dto.slug}" already exists.`);
      }
    }

    return this.prisma.page.update({ where: { id }, data: dto });
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  async remove(id: string) {
    const page = await this.findById(id);
    if (page.isSystem) {
      throw new ForbiddenException('System pages cannot be deleted.');
    }
    return this.prisma.page.delete({ where: { id } });
  }
}
