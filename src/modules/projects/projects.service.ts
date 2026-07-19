import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Media, Prisma, Project } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ReorderProjectsDto } from './dto/reorder-projects.dto';

// ── Response shape helper ─────────────────────────────────────────────────────
// Identical output keys to the previous include-based approach.
function mapProject(project: Project, media: Media[]) {
  return {
    ...project,
    screenshots: media.map((m) => ({
      mediaId: m.id,
      url: m.cloudinaryUrl,
      alt: m.alt,
    })),
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
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  // Simple existence check — no media query needed
  private async findOrThrow(id: string): Promise<Project> {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project "${id}" not found.`);
    }
    return project;
  }

  // Fetch project + its media (single-entity reads)
  private async fetchWithMedia(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project "${id}" not found.`);
    }
    const media = await this.prisma.media.findMany({
      where: { ownerType: 'project', ownerId: id },
      orderBy: { order: 'asc' },
    });
    return mapProject(project, media);
  }

  // ── Public: list published projects with screenshots ─────────────────────
  async findAllPublic(featured?: boolean) {
    const projects = await this.prisma.project.findMany({
      where: {
        published: true,
        ...(featured === true ? { featured: true } : {}),
      },
      orderBy: { order: 'asc' },
    });

    if (projects.length === 0) return [];

    // Batch media fetch — one query for all projects (avoids N+1)
    const ids = projects.map((p) => p.id);
    const allMedia = await this.prisma.media.findMany({
      where: { ownerType: 'project', ownerId: { in: ids } },
      orderBy: { order: 'asc' },
    });
    const mediaByOwner = groupByOwnerId(allMedia);

    return projects.map((p) => mapProject(p, mediaByOwner.get(p.id) ?? []));
  }

  // ── Admin: single project by ID with screenshots ─────────────────────────
  async findById(id: string) {
    return this.fetchWithMedia(id);
  }

  // ── Admin: list all projects (trimmed list for admin table) ───────────────
  findAllAdmin(featured?: boolean) {
    return this.prisma.project.findMany({
      where: featured === true ? { featured: true } : undefined,
      orderBy: { order: 'asc' },
      select: {
        id: true,
        slug: true,
        title: true,
        featured: true,
        published: true,
        order: true,
      },
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
    const media = await this.prisma.media.findMany({
      where: { ownerType: 'project', ownerId: project.id },
      orderBy: { order: 'asc' },
    });
    return mapProject(project, media);
  }

  // ── Admin: single project by slug (any status) ───────────────────────────
  async findBySlugAdmin(slug: string) {
    const project = await this.prisma.project.findUnique({ where: { slug } });
    if (!project) {
      throw new NotFoundException(`Project "${slug}" not found.`);
    }
    const media = await this.prisma.media.findMany({
      where: { ownerType: 'project', ownerId: project.id },
      orderBy: { order: 'asc' },
    });
    return mapProject(project, media);
  }

  // ── Create ───────────────────────────────────────────────────────────────
  async create(dto: CreateProjectDto, userId: string) {
    // Friendlier pre-check message (best-effort — the P2002 catch below is
    // the actual guarantee against the TOCTOU race between this check and
    // the insert).
    const existing = await this.prisma.project.findUnique({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(`A project with slug "${dto.slug}" already exists.`);
    }

    try {
      const project = await this.prisma.project.create({
        data: {
          ...dto,
          tags: dto.tags ?? [],
          stack: dto.stack ?? [],
          createdById: userId,
        },
      });

      // Newly created — no media linked yet (deferred-upload flow)
      return mapProject(project, []);
    } catch (error) {
      this.handleUniqueViolation(error, dto.slug);
    }
  }

  // ── Update ───────────────────────────────────────────────────────────────
  async update(id: string, dto: UpdateProjectDto, userId?: string) {
    await this.findOrThrow(id);

    if (dto.slug) {
      const conflict = await this.prisma.project.findFirst({
        where: { slug: dto.slug, NOT: { id } },
      });
      if (conflict) {
        throw new ConflictException(`A project with slug "${dto.slug}" already exists.`);
      }
    }

    try {
      await this.prisma.project.update({
        where: { id },
        data: { ...dto, ...(userId ? { updatedById: userId } : {}) },
      });
    } catch (error) {
      this.handleUniqueViolation(error, dto.slug);
    }
    return this.fetchWithMedia(id);
  }

  // ── Shared P2002 handler ─────────────────────────────────────────────────
  private handleUniqueViolation(error: unknown, slug?: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(
        slug
          ? `A project with slug "${slug}" already exists.`
          : 'A project with this value already exists.',
      );
    }
    throw error;
  }

  // ── Feature toggle ───────────────────────────────────────────────────────
  async toggleFeatured(id: string, userId?: string) {
    const project = await this.findOrThrow(id);
    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        featured: !project.featured,
        ...(userId ? { updatedById: userId } : {}),
      },
    });
    const media = await this.prisma.media.findMany({
      where: { ownerType: 'project', ownerId: id },
      orderBy: { order: 'asc' },
    });
    return mapProject(updated, media);
  }

  // ── Publish toggle ───────────────────────────────────────────────────────
  async togglePublished(id: string, userId?: string) {
    const project = await this.findOrThrow(id);
    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        published: !project.published,
        ...(userId ? { updatedById: userId } : {}),
      },
    });
    const media = await this.prisma.media.findMany({
      where: { ownerType: 'project', ownerId: id },
      orderBy: { order: 'asc' },
    });
    return mapProject(updated, media);
  }

  // ── Reorder ──────────────────────────────────────────────────────────────
  async reorder(dto: ReorderProjectsDto, userId?: string) {
    const updates = dto.projects.map((item) =>
      this.prisma.project.update({
        where: { id: item.id },
        data: { order: item.order, ...(userId ? { updatedById: userId } : {}) },
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
