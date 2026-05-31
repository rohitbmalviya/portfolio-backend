import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { ReorderSkillsDto } from './dto/reorder-skills.dto';

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  private async findOrThrow(id: string) {
    const skill = await this.prisma.skill.findUnique({ where: { id } });
    if (!skill) {
      throw new NotFoundException(`Skill "${id}" not found.`);
    }
    return skill;
  }

  // ── Public: all skills ordered ───────────────────────────────────────────
  findAll() {
    return this.prisma.skill.findMany({
      orderBy: [{ group: 'asc' }, { order: 'asc' }],
    });
  }

  findOne(id: string) {
    return this.findOrThrow(id);
  }

  async create(dto: CreateSkillDto) {
    return this.prisma.skill.create({ data: dto });
  }

  async update(id: string, dto: UpdateSkillDto) {
    await this.findOrThrow(id);
    return this.prisma.skill.update({ where: { id }, data: dto });
  }

  async reorder(dto: ReorderSkillsDto) {
    const updates = dto.skills.map((item) =>
      this.prisma.skill.update({
        where: { id: item.id },
        data: { order: item.order },
      }),
    );
    return this.prisma.$transaction(updates);
  }

  async remove(id: string) {
    await this.findOrThrow(id);
    return this.prisma.skill.delete({ where: { id } });
  }
}
