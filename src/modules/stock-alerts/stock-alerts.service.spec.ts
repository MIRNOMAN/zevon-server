import { Test, TestingModule } from '@nestjs/testing';
import { StockAlertsService } from './stock-alerts.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { StockAlertStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('StockAlertsService', () => {
  let service: StockAlertsService;
  let prisma: jest.Mocked<PrismaService>;
  let mailService: jest.Mocked<MailService>;

  const mockOutOfStockVariant = {
    id: 'var-1',
    sku: 'ZEV-TEE-BLK-M',
    size: 'M',
    color: 'Black',
    stock: 0,
    extraPrice: new Decimal(0),
    product: {
      id: 'prod-1',
      title: 'Oversized Tee',
      slug: 'oversized-tee',
      basePrice: new Decimal(1200),
      discountPrice: null,
      isPublished: true,
      images: [],
    },
  };

  beforeEach(async () => {
    const prismaMock = {
      productVariant: {
        findUnique: jest.fn().mockResolvedValue(mockOutOfStockVariant),
      },
      stockAlert: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'alert-1',
            ...data,
            productVariant: mockOutOfStockVariant,
            createdAt: new Date(),
          }),
        ),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'alert-1',
            email: 'customer@example.com',
            status: StockAlertStatus.PENDING,
            user: { name: 'Mir Noman' },
            productVariant: mockOutOfStockVariant,
          },
        ]),
        update: jest.fn().mockResolvedValue({
          id: 'alert-1',
          status: StockAlertStatus.NOTIFIED,
        }),
        count: jest.fn().mockResolvedValue(1),
      },
    };

    const mailMock = {
      sendBackInStockEmail: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockAlertsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: MailService, useValue: mailMock },
      ],
    }).compile();

    service = module.get<StockAlertsService>(StockAlertsService);
    prisma = module.get(PrismaService);
    mailService = module.get(MailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('subscribe', () => {
    it('should subscribe email for back-in-stock notifications when variant is out of stock', async () => {
      const res = await service.subscribe({
        productVariantId: 'var-1',
        email: 'customer@example.com',
      });

      expect(res.isAlreadyInStock).toBe(false);
      expect(res.subscriptionId).toBe('alert-1');
      expect(res.sku).toBe('ZEV-TEE-BLK-M');
      expect(prisma.stockAlert.create).toHaveBeenCalled();
    });

    it('should inform customer if variant is already in stock', async () => {
      (prisma.productVariant.findUnique as jest.Mock).mockResolvedValue({
        ...mockOutOfStockVariant,
        stock: 5,
      });

      const res = await service.subscribe({
        productVariantId: 'var-1',
        email: 'customer@example.com',
      });

      expect(res.isAlreadyInStock).toBe(true);
      expect(res.currentStock).toBe(5);
    });
  });

  describe('notifySubscribers', () => {
    it('should send back-in-stock email to all pending subscribers and update status to NOTIFIED', async () => {
      const res = await service.notifySubscribers('var-1', 10);

      expect(res.notifiedCount).toBe(1);
      expect(mailService.sendBackInStockEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          customerEmail: 'customer@example.com',
          productTitle: 'Oversized Tee',
          sku: 'ZEV-TEE-BLK-M',
        }),
      );
      expect(prisma.stockAlert.update).toHaveBeenCalledWith({
        where: { id: 'alert-1' },
        data: expect.objectContaining({ status: StockAlertStatus.NOTIFIED }),
      });
    });
  });
});
