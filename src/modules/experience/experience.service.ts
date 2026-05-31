import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExperienceDto } from './dto/create-experience.dto';
import { UpdateExperienceDto } from './dto/update-experience.dto';
import { ReorderExperienceDto } from './dto/reorder-experience.dto';

@Injectable()
export class ExperienceService {
  constructor(private readonly prisma: PrismaService) {}

  private async findOrThrow(id: string) {
    const exp = await this.prisma.experience.findUnique({ where: { id } });
    if (!exp) {
      throw new NotFoundException(`Experience "${id}" not found.`);
    }
    return exp;
  }

  findAll() {
    return this.prisma.experience.findMany({ orderBy: { order: 'asc' } });
  }

  findOne(id: string) {
    return this.findOrThrow(id);
  }

  async create(dto: CreateExperienceDto) {
    return this.prisma.experience.create({
      data: {
        ...dto,
        bullets: dto.bullets ?? [],
      },
    });
  }

  async update(id: string, dto: UpdateExperienceDto) {
    await this.findOrThrow(id);
    return this.prisma.experience.update({ where: { id }, data: dto });
  }

  async reorder(dto: ReorderExperienceDto) {
    const updates = dto.experience.map((item) =>
      this.prisma.experience.update({
        where: { id: item.id },
        data: { order: item.order },
      }),
    );
    return this.prisma.$transaction(updates);
  }

  async remove(id: string) {
    await this.findOrThrow(id);
    return this.prisma.experience.delete({ where: { id } });
  }
}
