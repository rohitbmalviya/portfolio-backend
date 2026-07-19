import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { HealthController } from './health.controller';
import { PrismaService } from '../../prisma/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: { $queryRaw: jest.Mock };

  function mockResponse(): jest.Mocked<Response> {
    const res = {} as jest.Mocked<Response>;
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  }

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns 200 with an "ok" body when the DB check resolves', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const res = mockResponse();

    await controller.check(res);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ok',
        db: 'ok',
        timestamp: expect.any(String),
      }),
    );
  });

  it('returns 503 with a "degraded" body when the DB check rejects', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
    const res = mockResponse();

    await controller.check(res);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'degraded',
        db: 'unreachable',
        error: 'connection refused',
        timestamp: expect.any(String),
      }),
    );
  });

  it('reports a generic error message when the rejection is not an Error instance', async () => {
    prisma.$queryRaw.mockRejectedValue('boom');
    const res = mockResponse();

    await controller.check(res);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'degraded', error: 'Unknown DB error' }),
    );
  });
});
