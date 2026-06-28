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

  // ── Skills grouped by category ────────────────────────────────────────────
  //
  // Order and labels are driven by the `skill_groups` Configuration row seeded
  // in the DB.  If that row is missing or empty, groups are derived from the
  // distinct `group` values actually present in the skills table (sorted
  // alphabetically) and the raw value is used as the label — no hardcoded list.
  async findAllGrouped() {
    const [skills, cfg] = await Promise.all([
      this.prisma.skill.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.configuration.findUnique({ where: { key: 'skill_groups' } }),
    ]);

    const raw = cfg?.items;
    const configItems: { value: string; label: string }[] = Array.isArray(raw)
      ? (raw as { value: string; label: string }[])
      : [];

    if (configItems.length > 0) {
      // Config-driven: use seeded order + labels, omit empty groups.
      return configItems
        .map(({ value: group, label }) => ({
          group,
          label,
          skills: skills.filter((s) => s.group === group),
        }))
        .filter((g) => g.skills.length > 0);
    }

    // Graceful fallback: group by distinct values present, sorted alphabetically.
    const distinctGroups = [...new Set(skills.map((s) => s.group))].sort();
    return distinctGroups.map((group) => ({
      group,
      label: group,
      skills: skills.filter((s) => s.group === group),
    }));
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
