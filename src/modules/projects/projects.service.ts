import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ReorderProjectsDto } from './dto/reorder-projects.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  private async findOrThrow(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project "${id}" not found.`);
    }
    return project;
  }

  // ── Public: list published projects ─────────────────────────────────────
  findAllPublic(featured?: boolean) {
    return this.prisma.project.findMany({
      where: {
        published: true,
        ...(featured === true ? { featured: true } : {}),
      },
      orderBy: { order: 'asc' },
    });
  }

  // ── Admin: list all projects ─────────────────────────────────────────────
  findAllAdmin(featured?: boolean) {
    return this.prisma.project.findMany({
      where: featured === true ? { featured: true } : undefined,
      orderBy: { order: 'asc' },
    });
  }

  // ── Public: single published project by slug ─────────────────────────────
  async findBySlugPublic(slug: string) {
    const project = await this.prisma.project.findFirst({
      where: { slug, published: true },
    });
    if (!project) {
      throw new NotFoundException(`Project "${slug}" not found.`);
    }
    return project;
  }

  // ── Admin: single project by slug (any status) ───────────────────────────
  async findBySlugAdmin(slug: string) {
    const project = await this.prisma.project.findUnique({ where: { slug } });
    if (!project) {
      throw new NotFoundException(`Project "${slug}" not found.`);
    }
    return project;
  }

  // ── Create ───────────────────────────────────────────────────────────────
  async create(dto: CreateProjectDto) {
    const existing = await this.prisma.project.findUnique({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(`A project with slug "${dto.slug}" already exists.`);
    }
    const { screenshots, ...rest } = dto;
    return this.prisma.project.create({
      data: {
        ...rest,
        tags: rest.tags ?? [],
        stack: rest.stack ?? [],
        screenshots: (screenshots as object[]) ?? [],
      },
    });
  }

  // ── Update ───────────────────────────────────────────────────────────────
  async update(id: string, dto: UpdateProjectDto) {
    await this.findOrThrow(id);
    if (dto.slug) {
      const conflict = await this.prisma.project.findFirst({
        where: { slug: dto.slug, NOT: { id } },
      });
      if (conflict) {
        throw new ConflictException(`A project with slug "${dto.slug}" already exists.`);
      }
    }
    const { screenshots, ...rest } = dto;
    return this.prisma.project.update({
      where: { id },
      data: {
        ...rest,
        ...(screenshots !== undefined ? { screenshots: screenshots as object[] } : {}),
      },
    });
  }

  // ── Feature toggle ───────────────────────────────────────────────────────
  async toggleFeatured(id: string) {
    const project = await this.findOrThrow(id);
    return this.prisma.project.update({
      where: { id },
      data: { featured: !project.featured },
    });
  }

  // ── Publish toggle ───────────────────────────────────────────────────────
  async togglePublished(id: string) {
    const project = await this.findOrThrow(id);
    return this.prisma.project.update({
      where: { id },
      data: { published: !project.published },
    });
  }

  // ── Reorder ──────────────────────────────────────────────────────────────
  async reorder(dto: ReorderProjectsDto) {
    const updates = dto.projects.map((item) =>
      this.prisma.project.update({
        where: { id: item.id },
        data: { order: item.order },
      }),
    );
    return this.prisma.$transaction(updates);
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  async remove(id: string) {
    await this.findOrThrow(id);
    return this.prisma.project.delete({ where: { id } });
  }
}
