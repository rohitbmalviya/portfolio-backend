import { Injectable } from '@nestjs/common';
import { Media, SiteSettings } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SINGLETON_ID } from './settings.constants';

export { SINGLETON_ID };

// ── Response shape helper ─────────────────────────────────────────────────────
// Returns the SAME keys as before: resumeUrl, resumeMediaId, ogImage, ogImageMediaId.
// Media is queried polymorphically via ownerType='settings', ownerId=SINGLETON_ID.
// `usage` on each Media row discriminates resume ('resume') vs OG image ('og').
function mapSettings(settings: SiteSettings, media: Media[]) {
  const resumeMedia = media.find((m) => m.usage === 'resume') ?? null;
  const ogMedia = media.find((m) => m.usage === 'og') ?? null;
  return {
    ...settings,
    resumeUrl: resumeMedia?.cloudinaryUrl ?? null,
    resumeMediaId: resumeMedia?.id ?? null,
    ogImage: ogMedia?.cloudinaryUrl ?? null,
    ogImageMediaId: ogMedia?.id ?? null,
  };
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Public: read the singleton ────────────────────────────────────────────
  async getSettings() {
    const settings = await this.prisma.siteSettings.findUnique({
      where: { id: SINGLETON_ID },
    });
    if (!settings) return null;

    const media = await this.prisma.media.findMany({
      where: { ownerType: 'settings', ownerId: SINGLETON_ID },
      orderBy: { order: 'asc' },
    });
    return mapSettings(settings, media);
  }

  // ── Admin: upsert the singleton ───────────────────────────────────────────
  async upsertSettings(dto: UpdateSettingsDto, userId?: string) {
    // Media linking happens via the upload endpoint (ownerId + ownerType + usage).
    // The settings DTO no longer carries resumeMediaId / ogImageMediaId.
    const { socials, ...rest } = dto;

    const settings = await this.prisma.siteSettings.upsert({
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        name: rest.name ?? '',
        tagline: rest.tagline ?? '',
        email: rest.email ?? '',
        location: rest.location ?? '',
        socials: (socials as object) ?? {},
        ...rest,
        ...(userId ? { createdById: userId } : {}),
      },
      update: {
        ...rest,
        ...(socials !== undefined ? { socials: socials as object } : {}),
        ...(userId ? { updatedById: userId } : {}),
      },
    });

    const media = await this.prisma.media.findMany({
      where: { ownerType: 'settings', ownerId: SINGLETON_ID },
      orderBy: { order: 'asc' },
    });
    return mapSettings(settings, media);
  }
}
