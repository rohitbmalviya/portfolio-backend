import { Test, TestingModule } from '@nestjs/testing';
import { ContactService } from './contact.service';
import { GmailService } from './gmail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';

describe('ContactService.createFromWeb', () => {
  let service: ContactService;
  let prisma: {
    contactThread: {
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
    };
    contactMessage: { create: jest.Mock };
    siteSettings: { findUnique: jest.Mock };
  };
  let gmail: { isConfigured: jest.Mock; sendNotification: jest.Mock };

  const baseDto: CreateContactDto = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    subject: 'Hello',
    message: 'Hi there, loved your portfolio.',
  };

  beforeEach(async () => {
    prisma = {
      contactThread: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      contactMessage: { create: jest.fn() },
      siteSettings: { findUnique: jest.fn() },
    };
    gmail = {
      isConfigured: jest.fn(),
      sendNotification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactService,
        { provide: PrismaService, useValue: prisma },
        { provide: GmailService, useValue: gmail },
      ],
    }).compile();

    service = module.get<ContactService>(ContactService);
  });

  it('short-circuits with success and does not persist or email when the honeypot is filled', async () => {
    const dto: CreateContactDto = { ...baseDto, website: 'https://spambot.example' };

    const result = await service.createFromWeb(dto);

    expect(result).toEqual({ success: true });
    expect(prisma.contactThread.create).not.toHaveBeenCalled();
    expect(gmail.isConfigured).not.toHaveBeenCalled();
    expect(gmail.sendNotification).not.toHaveBeenCalled();
  });

  it('proceeds normally when the honeypot is whitespace-only (trims to empty)', async () => {
    const dto: CreateContactDto = { ...baseDto, website: '   ' };
    prisma.contactThread.create.mockResolvedValue({ id: 'thread-ws' });
    gmail.isConfigured.mockReturnValue(false);

    const result = await service.createFromWeb(dto);

    expect(result).toEqual({ success: true });
    expect(prisma.contactThread.create).toHaveBeenCalledTimes(1);
  });

  it('persists the thread and proceeds normally when website is empty', async () => {
    const dto: CreateContactDto = { ...baseDto, website: '' };
    prisma.contactThread.create.mockResolvedValue({ id: 'thread-1' });
    gmail.isConfigured.mockReturnValue(false);

    const result = await service.createFromWeb(dto);

    expect(result).toEqual({ success: true });
    expect(prisma.contactThread.create).toHaveBeenCalledTimes(1);
    expect(prisma.contactThread.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: dto.name,
          email: dto.email,
          subject: dto.subject,
          unread: true,
        }),
      }),
    );
  });

  it('persists the thread and proceeds normally when website is absent', async () => {
    const dto: CreateContactDto = { ...baseDto };
    prisma.contactThread.create.mockResolvedValue({ id: 'thread-2' });
    gmail.isConfigured.mockReturnValue(false);

    const result = await service.createFromWeb(dto);

    expect(result).toEqual({ success: true });
    expect(prisma.contactThread.create).toHaveBeenCalledTimes(1);
    expect(gmail.sendNotification).not.toHaveBeenCalled();
  });

  it('sends a Gmail notification when Gmail is configured and normal submission succeeds', async () => {
    const dto: CreateContactDto = { ...baseDto };
    prisma.contactThread.create.mockResolvedValue({ id: 'thread-3' });
    prisma.siteSettings.findUnique.mockResolvedValue(null);
    gmail.isConfigured.mockReturnValue(true);
    gmail.sendNotification.mockResolvedValue({ id: 'gmail-msg-1', threadId: 'gmail-thread-1' });
    prisma.contactThread.update.mockResolvedValue({ id: 'thread-3' });
    prisma.contactMessage.create.mockResolvedValue({ id: 'msg-1' });

    const result = await service.createFromWeb(dto);

    expect(result).toEqual({ success: true });
    expect(gmail.sendNotification).toHaveBeenCalledTimes(1);
    expect(prisma.contactThread.update).toHaveBeenCalledWith({
      where: { id: 'thread-3' },
      data: { gmailThreadId: 'gmail-thread-1' },
    });
  });
});
