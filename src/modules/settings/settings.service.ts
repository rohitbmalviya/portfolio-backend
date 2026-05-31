import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

// The singleton row always has this fixed ID (enforced by schema comment and upsert)
const SINGLETON_ID = 'singleton';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Public: read the singleton ────────────────────────────────────────────
  getSettings() {
    return this.prisma.siteSettings.findUnique({
      where: { id: SINGLETON_ID },
    });
  }

  // ── Admin: upsert the singleton ───────────────────────────────────────────
  async upsertSettings(dto: UpdateSettingsDto) {
    const { socials, ...rest } = dto;

    return this.prisma.siteSettings.upsert({
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        name: rest.name ?? '',
        tagline: rest.tagline ?? '',
        email: rest.email ?? '',
        location: rest.location ?? '',
        socials: (socials as object) ?? {},
        ...rest,
      },
      update: {
        ...rest,
        ...(socials !== undefined ? { socials: socials as object } : {}),
      },
    });
  }
}
