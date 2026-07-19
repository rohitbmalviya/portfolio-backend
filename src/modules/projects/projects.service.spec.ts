import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';

function makeP2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed on the fields: (`slug`)',
    {
      code: 'P2002',
      clientVersion: '5.19.0',
      meta: { target: ['slug'] },
    },
  );
}

describe('ProjectsService — slug conflict handling', () => {
  let service: ProjectsService;
  let prisma: {
    project: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    media: { findMany: jest.Mock };
  };

  const dto: CreateProjectDto = {
    slug: 'my-project',
    title: 'My Project',
    oneLiner: 'A project',
    role: 'Engineer',
    metric: '10x',
    overview: 'Overview',
    contribution: 'Contribution',
    body: 'Body',
  };

  beforeEach(async () => {
    prisma = {
      project: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      media: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProjectsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  describe('create', () => {
    it('throws ConflictException when prisma.create rejects with a P2002 error', async () => {
      prisma.project.findUnique.mockResolvedValue(null); // pre-check passes (TOCTOU race)
      prisma.project.create.mockRejectedValue(makeP2002());

      await expect(service.create(dto, 'user-1')).rejects.toThrow(
        new ConflictException(`A project with slug "${dto.slug}" already exists.`),
      );
    });

    it('re-throws non-P2002 errors unchanged', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      const otherError = new Error('connection lost');
      prisma.project.create.mockRejectedValue(otherError);

      await expect(service.create(dto, 'user-1')).rejects.toBe(otherError);
    });
  });

  describe('update', () => {
    it('throws ConflictException when prisma.update rejects with a P2002 error', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'proj-1', slug: 'old-slug' });
      prisma.project.findFirst.mockResolvedValue(null); // pre-check passes
      prisma.project.update.mockRejectedValue(makeP2002());

      await expect(
        service.update('proj-1', { slug: 'taken-slug' }, 'user-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
