import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAchievementDto } from './dto/create-achievement.dto';
import { UpdateAchievementDto } from './dto/update-achievement.dto';
import { ReorderAchievementsDto } from './dto/reorder-achievements.dto';

@Injectable()
export class AchievementsService {
  constructor(private readonly prisma: PrismaService) {}

  private async findOrThrow(id: string) {
    const achievement = await this.prisma.achievement.findUnique({ where: { id } });
    if (!achievement) {
      throw new NotFoundException(`Achievement "${id}" not found.`);
    }
    return achievement;
  }

  findAll() {
    return this.prisma.achievement.findMany({
      orderBy: { order: 'asc' },
    });
  }

  findOne(id: string) {
    return this.findOrThrow(id);
  }

  async create(dto: CreateAchievementDto) {
    return this.prisma.achievement.create({
      data: { ...dto, date: dto.date ? new Date(dto.date) : null },
    });
  }

  async update(id: string, dto: UpdateAchievementDto) {
    await this.findOrThrow(id);
    const data: Prisma.AchievementUpdateInput = { ...dto };
    if (dto.date !== undefined) {
      data.date = dto.date ? new Date(dto.date) : null;
    }
    return this.prisma.achievement.update({ where: { id }, data });
  }

  async reorder(dto: ReorderAchievementsDto) {
    const updates = dto.achievements.map((item) =>
      this.prisma.achievement.update({
        where: { id: item.id },
        data: { order: item.order },
      }),
    );
    return this.prisma.$transaction(updates);
  }

  async remove(id: string) {
    await this.findOrThrow(id);
    return this.prisma.achievement.delete({ where: { id } });
  }
}
