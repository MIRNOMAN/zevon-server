import { Test, TestingModule } from '@nestjs/testing';
import { AbandonedCartService } from './abandoned-cart.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { Decimal } from '@prisma/client/runtime/library';

describe('AbandonedCartService', () => {
  let service: AbandonedCartService;
  let prisma: jest.Mocked<PrismaService>;
  let mailService: jest.Mocked<MailService>;

  const mockCart = {
    id: 'cart-1',
    userId: 'user-1',
    user: { id: 'user-1', name: 'Mir Noman', email: 'noman@example.com' },
    items: [
      {
        id: 'item-1',
        variant: {
          size: 'M',
          color: 'Black',
          extraPrice: new Decimal(0),
          imageUrl: null,
          product: {
            title: 'T-Shirt',
            basePrice: new Decimal(1200),
            discountPrice: null,
            images: [],
          },
        },
      },
    ],
  };

  beforeEach(async () => {
    const prismaMock = {
      cart: {
        findMany: jest.fn().mockResolvedValue([mockCart]),
        update: jest.fn().mockResolvedValue({ id: 'cart-1' }),
      },
      coupon: {
        create: jest.fn().mockResolvedValue({ id: 'coupon-1' }),
      },
    };

    const mailMock = {
      sendAbandonedCartEmail: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AbandonedCartService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: MailService, useValue: mailMock },
      ],
    }).compile();

    service = module.get<AbandonedCartService>(AbandonedCartService);
    prisma = module.get(PrismaService);
    mailService = module.get(MailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scanAndRecoverAbandonedCarts', () => {
    it('should find abandoned carts, create 10% recovery coupon, and send recovery email', async () => {
      const res = await service.scanAndRecoverAbandonedCarts();

      expect(res.scannedCartsCount).toBe(1);
      expect(res.dispatchedRecoveryEmails).toBe(1);
      expect(prisma.coupon.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            discountValue: expect.anything(),
          }),
        }),
      );
      expect(mailService.sendAbandonedCartEmail).toHaveBeenCalledWith(
        'noman@example.com',
        expect.objectContaining({
          customerName: 'Mir Noman',
          discountPercent: 10,
        }),
      );
      expect(prisma.cart.update).toHaveBeenCalled();
    });
  });
});
