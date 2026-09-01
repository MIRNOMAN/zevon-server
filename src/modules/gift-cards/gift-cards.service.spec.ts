import { Test, TestingModule } from '@nestjs/testing';
import { GiftCardsService } from './gift-cards.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { GiftCardStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('GiftCardsService', () => {
  let service: GiftCardsService;
  let prisma: jest.Mocked<PrismaService>;
  let mailService: jest.Mocked<MailService>;

  const mockGiftCard = {
    id: 'gc-1',
    code: 'ZEV-GIFT-8921-4829',
    initialBalance: new Decimal(2000),
    currentBalance: new Decimal(2000),
    recipientEmail: 'friend@example.com',
    recipientName: 'Tahmid Khan',
    customMessage: 'Happy Birthday!',
    status: GiftCardStatus.ACTIVE,
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          name: 'Mir Noman',
          email: 'noman@example.com',
        }),
      },
      giftCard: {
        create: jest.fn().mockResolvedValue(mockGiftCard),
        findUnique: jest.fn().mockResolvedValue(mockGiftCard),
        update: jest.fn().mockResolvedValue({
          ...mockGiftCard,
          currentBalance: new Decimal(500),
        }),
        findMany: jest.fn().mockResolvedValue([mockGiftCard]),
        count: jest.fn().mockResolvedValue(1),
      },
      giftCardRedemption: {
        create: jest.fn().mockResolvedValue({ id: 'red-1' }),
      },
      $transaction: jest
        .fn()
        .mockImplementation((promises) => Promise.all(promises)),
    };

    const mailMock = {
      sendGiftCardEmail: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GiftCardsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: MailService, useValue: mailMock },
      ],
    }).compile();

    service = module.get<GiftCardsService>(GiftCardsService);
    prisma = module.get(PrismaService);
    mailService = module.get(MailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('purchase', () => {
    it('should generate gift card voucher, dispatch email to recipient, and return card details', async () => {
      const res = await service.purchase('user-1', {
        amount: 2000,
        recipientEmail: 'friend@example.com',
        recipientName: 'Tahmid Khan',
        customMessage: 'Happy Birthday!',
      });

      expect(res.code).toBe('ZEV-GIFT-8921-4829');
      expect(res.initialBalance).toBe(2000);
      expect(prisma.giftCard.create).toHaveBeenCalled();
      expect(mailService.sendGiftCardEmail).toHaveBeenCalledWith(
        'friend@example.com',
        expect.objectContaining({ code: 'ZEV-GIFT-8921-4829', balance: 2000 }),
      );
    });
  });

  describe('checkBalance', () => {
    it('should return gift card balance and validity', async () => {
      const res = await service.checkBalance({ code: 'ZEV-GIFT-8921-4829' });

      expect(res.code).toBe('ZEV-GIFT-8921-4829');
      expect(res.currentBalance).toBe(2000);
      expect(res.isValid).toBe(true);
    });
  });

  describe('redeem', () => {
    it('should deduct voucher balance atomically and record redemption', async () => {
      const res = await service.redeem('user-1', {
        code: 'ZEV-GIFT-8921-4829',
        amount: 1500,
        orderId: 'order-123',
      });

      expect(res.amountDeducted).toBe(1500);
      expect(res.remainingBalance).toBe(500);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
