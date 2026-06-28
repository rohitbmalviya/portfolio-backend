import { Injectable, NotFoundException } from '@nestjs/common';
import { Achievement, Media, Prisma } from '@prisma/client'; // Prisma used for UncheckedUpdateInput
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAchievementDto } from './dto/create-achievement.dto';
import { UpdateAchievementDto } from './dto/update-achievement.dto';
import { ReorderAchievementsDto } from './dto/reorder-achievements.dto';

// ── Response shape helper ─────────────────────────────────────────────────────
// Returns the SAME keys as before: `image` (URL) and `imageMediaId` (id).
function mapAchievement(ach: Achievement, media: Media[]) {
  const imageMedia = media[0] ?? null;
  return {
    ...ach,
    image: imageMedia?.cloudinaryUrl ?? null,
    imageMediaId: imageMedia?.id ?? null,
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
export class AchievementsService {
  constructor(private readonly prisma: PrismaService) {}

  // Existence guard — does not need the media query
  private async findOrThrow(id: string): Promise<Achievement> {
    const ach = await this.prisma.achievement.findUnique({ where: { id } });
    if (!ach) {
      throw new NotFoundException(`Achievement "${id}" not found.`);
    }
    return ach;
  }

  async findAll() {
    const achs = await this.prisma.achievement.findMany({
      orderBy: { order: 'asc' },
    });

    if (achs.length === 0) return [];

    // Batch media fetch — one query for all achievements
    const ids = achs.map((a) => a.id);
    const allMedia = await this.prisma.media.findMany({
      where: { ownerType: 'achievement', ownerId: { in: ids } },
      orderBy: { order: 'asc' },
    });
    const mediaByOwner = groupByOwnerId(allMedia);

    return achs.map((a) => mapAchievement(a, mediaByOwner.get(a.id) ?? []));
  }

  async findOne(id: string) {
    const ach = await this.prisma.achievement.findUnique({ where: { id } });
    if (!ach) {
      throw new NotFoundException(`Achievement "${id}" not found.`);
    }
    const media = await this.prisma.media.findMany({
      where: { ownerType: 'achievement', ownerId: id },
      orderBy: { order: 'asc' },
    });
    return mapAchievement(ach, media);
  }

  async create(dto: CreateAchievementDto, userId: string) {
    const ach = await this.prisma.achievement.create({
      data: {
        ...dto,
        date: dto.date ? new Date(dto.date) : null,
        createdById: userId,
      },
    });

    // Newly created — no media linked yet (deferred-upload flow)
    return mapAchievement(ach, []);
  }

  async update(id: string, dto: UpdateAchievementDto, userId?: string) {
    await this.findOrThrow(id);

    const { date, ...rest } = dto;
    const data: Prisma.AchievementUncheckedUpdateInput = {
      ...rest,
      ...(date !== undefined ? { date: date ? new Date(date) : null } : {}),
      ...(userId ? { updatedById: userId } : {}),
    };

    const ach = await this.prisma.achievement.update({ where: { id }, data });

    const media = await this.prisma.media.findMany({
      where: { ownerType: 'achievement', ownerId: id },
      orderBy: { order: 'asc' },
    });
    return mapAchievement(ach, media);
  }

  async reorder(dto: ReorderAchievementsDto, userId?: string) {
    const updates = dto.achievements.map((item) =>
      this.prisma.achievement.update({
        where: { id: item.id },
        data: { order: item.order, ...(userId ? { updatedById: userId } : {}) },
      }),
    );
    return this.prisma.$transaction(updates);
  }

  async remove(id: string) {
    await this.findOrThrow(id);
    return this.prisma.achievement.delete({ where: { id } });
  }
}
