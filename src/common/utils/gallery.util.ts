import { Section } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * gallery.util.ts
 *
 * For every GALLERY section in the list, fetches the Media rows that are
 * owned by that section (ownerType = 'section', ownerId = section.id) in a
 * SINGLE batch query, groups them by ownerId, and replaces each gallery
 * section's `data.images` with the ordered media records.
 *
 * Non-GALLERY sections pass through unchanged.
 * Sections with no linked media get `data.images = []` (no inline fallback).
 * Other `data` keys (e.g. `heading`) are preserved.
 *
 * Shape of each injected image entry:
 *   { mediaId: string; url: string; alt: string }
 */
export async function attachGalleryImages(
  prisma: PrismaService,
  sections: Section[],
): Promise<Section[]> {
  const galleryIds = sections
    .filter((s) => s.type === 'GALLERY')
    .map((s) => s.id);

  if (galleryIds.length === 0) return sections;

  const media = await prisma.media.findMany({
    where: { ownerType: 'section', ownerId: { in: galleryIds } },
    orderBy: { order: 'asc' },
  });

  // Group by owning section id — O(n) single pass
  const mediaBySection = new Map<string, typeof media>();
  for (const m of media) {
    if (!m.ownerId) continue;
    const bucket = mediaBySection.get(m.ownerId) ?? [];
    bucket.push(m);
    mediaBySection.set(m.ownerId, bucket);
  }

  return sections.map((s) => {
    if (s.type !== 'GALLERY') return s;

    const sectionMedia = mediaBySection.get(s.id) ?? [];

    // Build the canonical images array — Media is the source of truth
    const images = sectionMedia.map((m) => ({
      mediaId: m.id,
      url: m.cloudinaryUrl,
      alt: m.alt ?? '',
    }));

    // Preserve other data keys (e.g. `heading`); overwrite `images`
    const existingData =
      typeof s.data === 'object' && s.data !== null && !Array.isArray(s.data)
        ? (s.data as Record<string, unknown>)
        : {};

    return {
      ...s,
      data: { ...existingData, images } as unknown as typeof s.data,
    };
  });
}
