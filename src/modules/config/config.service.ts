import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PageType,
  SectionType,
  SkillGroup,
  SkillLevel,
  DefaultTheme,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateConfigDto } from './dto/update-config.dto';

@Injectable()
export class ConfigService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Admin-editable option sets ───────────────────────────────────────────
  findAll() {
    return this.prisma.configuration.findMany({ orderBy: { key: 'asc' } });
  }

  async findByKey(key: string) {
    const cfg = await this.prisma.configuration.findUnique({ where: { key } });
    if (!cfg) {
      throw new NotFoundException(`Configuration "${key}" not found.`);
    }
    return cfg;
  }

  // Upsert items (and optional label) for a key.
  update(key: string, dto: UpdateConfigDto) {
    return this.prisma.configuration.upsert({
      where: { key },
      update: {
        items: dto.items as unknown as Prisma.InputJsonValue,
        ...(dto.label !== undefined ? { label: dto.label } : {}),
      },
      create: {
        key,
        label: dto.label ?? key,
        items: dto.items as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // ── Read-only schema enums (code-defined, single source of truth) ────────
  getEnums() {
    return {
      PageType: Object.values(PageType),
      SectionType: Object.values(SectionType),
      SkillGroup: Object.values(SkillGroup),
      SkillLevel: Object.values(SkillLevel),
      DefaultTheme: Object.values(DefaultTheme),
    };
  }
}
