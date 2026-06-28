import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Experience, Media, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExperienceDto } from './dto/create-experience.dto';
import { UpdateExperienceDto } from './dto/update-experience.dto';
import { ReorderExperienceDto } from './dto/reorder-experience.dto';

// ── Response shape helper ─────────────────────────────────────────────────────
// Returns the SAME keys as before: `logo` (URL) and `logoMediaId` (id).
function mapExperience(exp: Experience, media: Media[]) {
  const logoMedia = media[0] ?? null;
  return {
    ...exp,
    logo: logoMedia?.cloudinaryUrl ?? null,
    logoMediaId: logoMedia?.id ?? null,
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
export class ExperienceService {
  constructor(private readonly prisma: PrismaService) {}

  // Existence guard — does not need the media query
  private async findOrThrow(id: string): Promise<Experience> {
    const exp = await this.prisma.experience.findUnique({ where: { id } });
    if (!exp) {
      throw new NotFoundException(`Experience "${id}" not found.`);
    }
    return exp;
  }

  async findAll() {
    const exps = await this.prisma.experience.findMany({
      orderBy: { order: 'asc' },
    });

    if (exps.length === 0) return [];

    // Batch media fetch — one query for all experiences
    const ids = exps.map((e) => e.id);
    const allMedia = await this.prisma.media.findMany({
      where: { ownerType: 'experience', ownerId: { in: ids } },
      orderBy: { order: 'asc' },
    });
    const mediaByOwner = groupByOwnerId(allMedia);

    return exps.map((e) => mapExperience(e, mediaByOwner.get(e.id) ?? []));
  }

  async findOne(id: string) {
    const exp = await this.prisma.experience.findUnique({ where: { id } });
    if (!exp) {
      throw new NotFoundException(`Experience "${id}" not found.`);
    }
    const media = await this.prisma.media.findMany({
      where: { ownerType: 'experience', ownerId: id },
      orderBy: { order: 'asc' },
    });
    return mapExperience(exp, media);
  }

  async create(dto: CreateExperienceDto, userId: string) {
    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (endDate && endDate < startDate) {
      throw new BadRequestException('End date cannot be before the start date.');
    }

    const { startDate: _s, endDate: _e, ...rest } = dto;

    const exp = await this.prisma.experience.create({
      data: {
        ...rest,
        startDate,
        endDate,
        bullets: rest.bullets ?? [],
        createdById: userId,
      },
    });

    // Newly created — no media linked yet (deferred-upload flow)
    return mapExperience(exp, []);
  }

  async update(id: string, dto: UpdateExperienceDto, userId?: string) {
    const existing = await this.findOrThrow(id);

    const { startDate: _startDate, endDate: _endDate, ...restDto } = dto;
    const data: Prisma.ExperienceUncheckedUpdateInput = { ...restDto };

    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) {
      data.endDate = dto.endDate ? new Date(dto.endDate) : null;
    }
    if (userId) {
      data.updatedById = userId;
    }

    const start = (data.startDate as Date | undefined) ?? existing.startDate;
    const end = (data.endDate as Date | null | undefined) ?? existing.endDate;
    if (end && start && new Date(end) < new Date(start)) {
      throw new BadRequestException('End date cannot be before the start date.');
    }

    const exp = await this.prisma.experience.update({ where: { id }, data });

    const media = await this.prisma.media.findMany({
      where: { ownerType: 'experience', ownerId: id },
      orderBy: { order: 'asc' },
    });
    return mapExperience(exp, media);
  }

  async reorder(dto: ReorderExperienceDto, userId?: string) {
    const updates = dto.experience.map((item) =>
      this.prisma.experience.update({
        where: { id: item.id },
        data: { order: item.order, ...(userId ? { updatedById: userId } : {}) },
      }),
    );
    return this.prisma.$transaction(updates);
  }

  async remove(id: string) {
    await this.findOrThrow(id);
    return this.prisma.experience.delete({ where: { id } });
  }
}
