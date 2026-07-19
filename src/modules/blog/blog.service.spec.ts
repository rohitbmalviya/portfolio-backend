import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BlogService } from './blog.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';

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

describe('BlogService — slug conflict handling', () => {
  let service: BlogService;
  let prisma: {
    blogPost: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    media: { findMany: jest.Mock };
  };

  const dto: CreateBlogPostDto = {
    slug: 'my-post',
    title: 'My Post',
    excerpt: 'Excerpt',
    body: 'Body',
  };

  beforeEach(async () => {
    prisma = {
      blogPost: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      media: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [BlogService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<BlogService>(BlogService);
  });

  describe('create', () => {
    it('throws ConflictException when prisma.create rejects with a P2002 error', async () => {
      prisma.blogPost.findUnique.mockResolvedValue(null); // pre-check passes (TOCTOU race)
      prisma.blogPost.create.mockRejectedValue(makeP2002());

      await expect(service.create(dto, 'user-1')).rejects.toThrow(
        new ConflictException(`A blog post with slug "${dto.slug}" already exists.`),
      );
    });

    it('re-throws non-P2002 errors unchanged', async () => {
      prisma.blogPost.findUnique.mockResolvedValue(null);
      const otherError = new Error('connection lost');
      prisma.blogPost.create.mockRejectedValue(otherError);

      await expect(service.create(dto, 'user-1')).rejects.toBe(otherError);
    });
  });

  describe('update', () => {
    it('throws ConflictException when prisma.update rejects with a P2002 error', async () => {
      prisma.blogPost.findUnique.mockResolvedValue({ id: 'post-1', slug: 'old-slug' });
      prisma.blogPost.findFirst.mockResolvedValue(null); // pre-check passes
      prisma.blogPost.update.mockRejectedValue(makeP2002());

      await expect(
        service.update('post-1', { slug: 'taken-slug' }, 'user-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
