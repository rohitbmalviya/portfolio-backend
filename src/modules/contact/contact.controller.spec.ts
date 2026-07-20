import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';

describe('ContactController', () => {
  let controller: ContactController;
  let contactService: {
    syncAll: jest.Mock;
  };

  const ORIGINAL_ENV = process.env;

  beforeEach(async () => {
    // Start each test from a clean env snapshot so CRON_SECRET never leaks
    // between tests, then restore afterwards.
    process.env = { ...ORIGINAL_ENV };
    delete process.env['CRON_SECRET'];

    contactService = {
      syncAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactController],
      providers: [{ provide: ContactService, useValue: contactService }],
    }).compile();

    controller = module.get<ContactController>(ContactController);
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('syncCron', () => {
    it('runs the sync when the header matches CRON_SECRET', async () => {
      process.env['CRON_SECRET'] = 'shh-super-secret';
      contactService.syncAll.mockResolvedValue({ synced: 3, errors: 0 });

      const result = await controller.syncCron('shh-super-secret');

      expect(contactService.syncAll).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ data: { synced: 3, errors: 0 } });
    });

    it('throws 401 and never calls syncAll when the header does not match CRON_SECRET', async () => {
      process.env['CRON_SECRET'] = 'shh-super-secret';

      await expect(controller.syncCron('wrong-value')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(contactService.syncAll).not.toHaveBeenCalled();
    });

    it('throws 401 and never calls syncAll when the header is absent, even if CRON_SECRET is set', async () => {
      process.env['CRON_SECRET'] = 'shh-super-secret';

      await expect(controller.syncCron(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(contactService.syncAll).not.toHaveBeenCalled();
    });

    it('throws 401 and never calls syncAll when CRON_SECRET is unset, regardless of the header sent', async () => {
      delete process.env['CRON_SECRET'];

      await expect(controller.syncCron('any-value-at-all')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(contactService.syncAll).not.toHaveBeenCalled();
    });

    it('throws 401 and never calls syncAll when both CRON_SECRET and the header are unset/absent', async () => {
      delete process.env['CRON_SECRET'];

      await expect(controller.syncCron(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(contactService.syncAll).not.toHaveBeenCalled();
    });
  });
});
