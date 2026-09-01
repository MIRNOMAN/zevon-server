import { Test, TestingModule } from '@nestjs/testing';
import { LoyaltyService } from './loyalty.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { CustomerTier, PointTransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('LoyaltyService', () => {
  let service: LoyaltyService;
  let prisma: jest.Mocked<PrismaService>;

  const mockAccount = {
    id: 'loyalty-1',
    userId: 'user-1',
    pointsBalance: 150,
    lifetimePointsEarned: 200,
    lifetimeSpent: new Decimal(6000),
    tier: CustomerTier.SILVER,
    transactions: [
      {
        id: 'tx-1',
        loyaltyAccountId: 'loyalty-1',
        amount: 50,
        type: PointTransactionType.EARNED,
        description: 'Earned 50 points',
        referenceId: 'order-1',
        createdAt: new Date(),
      },
    ],
  };

  beforeEach(async () => {
    const prismaMock = {
      loyaltyAccount: {
        findUnique: jest.fn().mockResolvedValue(mockAccount),
        create: jest.fn().mockResolvedValue(mockAccount),
        update: jest
          .fn()
          .mockResolvedValue({ ...mockAccount, pointsBalance: 100 }),
        upsert: jest
          .fn()
          .mockResolvedValue({ ...mockAccount, pointsBalance: 200 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoyaltyService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<LoyaltyService>(LoyaltyService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAccount', () => {
    it('should return points balance, BDT equivalent, tier details, and transactions', async () => {
      const res = await service.getAccount('user-1');

      expect(res.pointsBalance).toBe(150);
      expect(res.pointsValueBDT).toBe(150);
      expect(res.tier).toBe(CustomerTier.SILVER);
      expect(res.tierDetails.multiplier).toBe(1.25);
      expect(res.recentTransactions).toHaveLength(1);
    });
  });

  describe('awardPurchasePoints', () => {
    it('should award points calculated with tier multiplier and elevate tier', async () => {
      const res = await service.awardPurchasePoints(
        'user-1',
        4000,
        'order-123',
      );

      expect(res.earnedPoints).toBe(50); // (4000 / 100) * 1.25 = 50
      expect(prisma.loyaltyAccount.upsert).toHaveBeenCalled();
    });
  });

  describe('redeemPoints', () => {
    it('should deduct points and return discount amount in BDT', async () => {
      const res = await service.redeemPoints('user-1', 50, 'order-123');

      expect(res.pointsRedeemed).toBe(50);
      expect(res.discountAmountBDT).toBe(50);
      expect(prisma.loyaltyAccount.update).toHaveBeenCalled();
    });
  });
});
