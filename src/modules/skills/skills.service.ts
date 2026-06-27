import { Injectable, NotFoundException } from '@nestjs/common';
import { SkillGroup } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { ReorderSkillsDto } from './dto/reorder-skills.dto';

// Canonical group order + display labels (single source of truth for grouping).
const GROUP_ORDER: SkillGroup[] = [
  'LANGUAGES',
  'FRONTEND',
  'BACKEND',
  'DATA',
  'CLOUD_DEVOPS',
  'AI',
];
const GROUP_LABELS: Record<SkillGroup, string> = {
  LANGUAGES: 'Languages',
  FRONTEND: 'Frontend',
  BACKEND: 'Backend',
  DATA: 'Data',
  CLOUD_DEVOPS: 'Cloud / DevOps',
  AI: 'AI',
};

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

  // ── Skills grouped by category (canonical order; empty groups omitted) ────
  async findAllGrouped() {
    const skills = await this.prisma.skill.findMany({ orderBy: { order: 'asc' } });
    return GROUP_ORDER.map((group) => ({
      group,
      label: GROUP_LABELS[group],
      skills: skills
        .filter((s) => s.group === group)
        .sort((a, b) => a.order - b.order),
    })).filter((g) => g.skills.length > 0);
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
