import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEducationDto } from './dto/create-education.dto';
import { UpdateEducationDto } from './dto/update-education.dto';
import { ReorderEducationDto } from './dto/reorder-education.dto';

@Injectable()
export class EducationService {
  constructor(private readonly prisma: PrismaService) {}

  private async findOrThrow(id: string) {
    const edu = await this.prisma.education.findUnique({ where: { id } });
    if (!edu) {
      throw new NotFoundException(`Education "${id}" not found.`);
    }
    return edu;
  }

  findAll() {
    return this.prisma.education.findMany({ orderBy: { order: 'asc' } });
  }

  findOne(id: string) {
    return this.findOrThrow(id);
  }

  async create(dto: CreateEducationDto) {
    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (endDate && endDate < startDate) {
      throw new BadRequestException('End date cannot be before the start date.');
    }
    return this.prisma.education.create({
      data: { ...dto, startDate, endDate },
    });
  }

  async update(id: string, dto: UpdateEducationDto) {
    const existing = await this.findOrThrow(id);
    const data: Prisma.EducationUpdateInput = { ...dto };
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) {
      data.endDate = dto.endDate ? new Date(dto.endDate) : null;
    }
    const start = (data.startDate as Date) ?? existing.startDate;
    const end = (data.endDate as Date | null) ?? existing.endDate;
    if (end && start && new Date(end) < new Date(start)) {
      throw new BadRequestException('End date cannot be before the start date.');
    }
    return this.prisma.education.update({ where: { id }, data });
  }

  async reorder(dto: ReorderEducationDto) {
    const updates = dto.education.map((item) =>
      this.prisma.education.update({
        where: { id: item.id },
        data: { order: item.order },
      }),
    );
    return this.prisma.$transaction(updates);
  }

  async remove(id: string) {
    await this.findOrThrow(id);
    return this.prisma.education.delete({ where: { id } });
  }
}
