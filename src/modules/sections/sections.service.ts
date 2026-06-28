import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { ReorderSectionsDto } from './dto/reorder-sections.dto';

@Injectable()
export class SectionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ──────────────────────────────────────────────────────────────
  private async findOrThrow(id: string) {
    const section = await this.prisma.section.findUnique({ where: { id } });
    if (!section) {
      throw new NotFoundException(`Section "${id}" not found.`);
    }
    return section;
  }

  // ── List by page ─────────────────────────────────────────────────────────
  findByPage(pageId: string, adminMode = false) {
    return this.prisma.section.findMany({
      where: adminMode ? { pageId } : { pageId, enabled: true },
      orderBy: { order: 'asc' },
    });
  }

  // ── Single ───────────────────────────────────────────────────────────────
  async findOne(id: string) {
    return this.findOrThrow(id);
  }

  // ── Create ───────────────────────────────────────────────────────────────
  async create(dto: CreateSectionDto, userId?: string) {
    // Verify page exists
    const page = await this.prisma.page.findUnique({ where: { id: dto.pageId } });
    if (!page) {
      throw new NotFoundException(`Page "${dto.pageId}" not found.`);
    }

    return this.prisma.section.create({
      data: {
        pageId: dto.pageId,
        type: dto.type,
        order: dto.order ?? 0,
        enabled: dto.enabled ?? true,
        data: (dto.data as object) ?? {},
        ...(userId ? { createdById: userId } : {}),
      },
    });
  }

  // ── Update ───────────────────────────────────────────────────────────────
  async update(id: string, dto: UpdateSectionDto, userId?: string) {
    await this.findOrThrow(id);
    const { data, ...rest } = dto;
    return this.prisma.section.update({
      where: { id },
      data: {
        ...rest,
        ...(data !== undefined ? { data: data as object } : {}),
        ...(userId ? { updatedById: userId } : {}),
      },
    });
  }

  // ── Toggle enabled ───────────────────────────────────────────────────────
  async toggleEnabled(id: string, userId?: string) {
    const section = await this.findOrThrow(id);
    return this.prisma.section.update({
      where: { id },
      data: {
        enabled: !section.enabled,
        ...(userId ? { updatedById: userId } : {}),
      },
    });
  }

  // ── Reorder ──────────────────────────────────────────────────────────────
  async reorder(dto: ReorderSectionsDto, userId?: string) {
    const updates = dto.sections.map((item) =>
      this.prisma.section.update({
        where: { id: item.id },
        data: { order: item.order, ...(userId ? { updatedById: userId } : {}) },
      }),
    );
    return this.prisma.$transaction(updates);
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  async remove(id: string) {
    await this.findOrThrow(id);
    return this.prisma.section.delete({ where: { id } });
  }
}
