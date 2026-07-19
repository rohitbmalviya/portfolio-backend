import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MediaService } from './media.service';
import { CloudinaryProvider } from './cloudinary.provider';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_MEDIA_PAGE_SIZE } from './media.constants';

describe('MediaService.findAll', () => {
  let service: MediaService;
  let prisma: {
    media: { findMany: jest.Mock; count: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      media: { findMany: jest.fn(), count: jest.fn() },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: PrismaService, useValue: prisma },
        { provide: CloudinaryProvider, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
  });

  it('returns the plain array (backward-compatible shape) when called with no params', async () => {
    const rows = [{ id: 'm1' }, { id: 'm2' }];
    prisma.media.findMany.mockResolvedValue(rows);

    const result = await service.findAll();

    expect(result).toBe(rows);
    expect(prisma.media.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns the plain array when query is provided but page/pageSize are both undefined', async () => {
    const rows = [{ id: 'm1' }];
    prisma.media.findMany.mockResolvedValue(rows);

    const result = await service.findAll({});

    expect(result).toBe(rows);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns { items, meta } and applies default pageSize when only page is given', async () => {
    const items = [{ id: 'm1' }, { id: 'm2' }];
    prisma.$transaction.mockResolvedValue([items, 42]);

    const result = await service.findAll({ page: 2 });

    expect(result).toEqual({
      items,
      meta: { total: 42, page: 2, pageSize: DEFAULT_MEDIA_PAGE_SIZE },
    });
    // skip = (page - 1) * pageSize = (2 - 1) * 20 = 20
    expect(prisma.media.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      skip: 20,
      take: DEFAULT_MEDIA_PAGE_SIZE,
    });
  });

  it('computes skip/take correctly from explicit page and pageSize, and returns meta.total from the count', async () => {
    const items = [{ id: 'm5' }];
    prisma.$transaction.mockResolvedValue([items, 101]);

    const result = await service.findAll({ page: 3, pageSize: 10 });

    expect(result).toEqual({ items, meta: { total: 101, page: 3, pageSize: 10 } });
    expect(prisma.media.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      // skip = (3 - 1) * 10 = 20
      skip: 20,
      take: 10,
    });
    expect(prisma.media.count).toHaveBeenCalledWith();
  });

  it('defaults page to 1 when only pageSize is given', async () => {
    prisma.$transaction.mockResolvedValue([[], 0]);

    await service.findAll({ pageSize: 5 });

    expect(prisma.media.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 5,
    });
  });
});
