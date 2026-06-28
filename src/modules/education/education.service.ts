import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Education, Media, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEducationDto } from './dto/create-education.dto';
import { UpdateEducationDto } from './dto/update-education.dto';
import { ReorderEducationDto } from './dto/reorder-education.dto';

// ── Response shape helper ─────────────────────────────────────────────────────
// Returns the SAME keys as before: `logo` (URL) and `logoMediaId` (id).
function mapEducation(edu: Education, media: Media[]) {
  const logoMedia = media[0] ?? null;
  return {
    ...edu,
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
export class EducationService {
  constructor(private readonly prisma: PrismaService) {}

  // Existence guard — does not need the media query
  private async findOrThrow(id: string): Promise<Education> {
    const edu = await this.prisma.education.findUnique({ where: { id } });
    if (!edu) {
      throw new NotFoundException(`Education "${id}" not found.`);
    }
    return edu;
  }

  async findAll() {
    const edus = await this.prisma.education.findMany({
      orderBy: { order: 'asc' },
    });

    if (edus.length === 0) return [];

    // Batch media fetch — one query for all education rows
    const ids = edus.map((e) => e.id);
    const allMedia = await this.prisma.media.findMany({
      where: { ownerType: 'education', ownerId: { in: ids } },
      orderBy: { order: 'asc' },
    });
    const mediaByOwner = groupByOwnerId(allMedia);

    return edus.map((e) => mapEducation(e, mediaByOwner.get(e.id) ?? []));
  }

  async findOne(id: string) {
    const edu = await this.prisma.education.findUnique({ where: { id } });
    if (!edu) {
      throw new NotFoundException(`Education "${id}" not found.`);
    }
    const media = await this.prisma.media.findMany({
      where: { ownerType: 'education', ownerId: id },
      orderBy: { order: 'asc' },
    });
    return mapEducation(edu, media);
  }

  async create(dto: CreateEducationDto, userId: string) {
    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (endDate && endDate < startDate) {
      throw new BadRequestException('End date cannot be before the start date.');
    }

    const { startDate: _s, endDate: _e, ...rest } = dto;

    const edu = await this.prisma.education.create({
      data: { ...rest, startDate, endDate, createdById: userId },
    });

    // Newly created — no media linked yet (deferred-upload flow)
    return mapEducation(edu, []);
  }

  async update(id: string, dto: UpdateEducationDto, userId?: string) {
    const existing = await this.findOrThrow(id);

    const { startDate: _startDate, endDate: _endDate, ...restDto } = dto;
    const data: Prisma.EducationUncheckedUpdateInput = { ...restDto };

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

    const edu = await this.prisma.education.update({ where: { id }, data });

    const media = await this.prisma.media.findMany({
      where: { ownerType: 'education', ownerId: id },
      orderBy: { order: 'asc' },
    });
    return mapEducation(edu, media);
  }

  async reorder(dto: ReorderEducationDto, userId?: string) {
    const updates = dto.education.map((item) =>
      this.prisma.education.update({
        where: { id: item.id },
        data: { order: item.order, ...(userId ? { updatedById: userId } : {}) },
      }),
    );
    return this.prisma.$transaction(updates);
  }

  async remove(id: string) {
    await this.findOrThrow(id);
    return this.prisma.education.delete({ where: { id } });
  }
}
