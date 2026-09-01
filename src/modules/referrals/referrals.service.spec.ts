import { Test, TestingModule } from '@nestjs/testing';
import { ReferralsService } from './referrals.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { LoyaltyService } from '../loyalty/loyalty.service.js';
import { ReferralStatus } from '@prisma/client';

describe('ReferralsService', () => {
  let service: ReferralsService;
  let prisma: jest.Mocked<PrismaService>;
  let mailService: jest.Mocked<MailService>;
  let loyaltyService: jest.Mocked<LoyaltyService>;

  const mockUser = {
    id: 'user-1',
    name: 'Mir Noman',
    referralCode: 'ZEV-NOMAN-1234',
  };

  beforeEach(async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
        update: jest.fn().mockResolvedValue(mockUser),
      },
      referral: {
        count: jest.fn().mockResolvedValue(3),
        upsert: jest
          .fn()
          .mockResolvedValue({ id: 'ref-1', status: ReferralStatus.PENDING }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'ref-1',
          referrerId: 'user-1',
          refereeId: 'user-2',
          status: ReferralStatus.PENDING,
          referrer: {
            id: 'user-1',
            name: 'Mir Noman',
            email: 'noman@example.com',
          },
          referee: {
            id: 'user-2',
            name: 'Friend User',
            email: 'friend@example.com',
          },
        }),
        update: jest
          .fn()
          .mockResolvedValue({ id: 'ref-1', status: ReferralStatus.REWARDED }),
      },
    };

    const mailMock = {
      sendReferralRewardEmail: jest.fn().mockResolvedValue(true),
    };

    const loyaltyMock = {
      adjustPoints: jest.fn().mockResolvedValue({ newBalance: 100 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: MailService, useValue: mailMock },
        { provide: LoyaltyService, useValue: loyaltyMock },
      ],
    }).compile();

    service = module.get<ReferralsService>(ReferralsService);
    prisma = module.get(PrismaService);
    mailService = module.get(MailService);
    loyaltyService = module.get(LoyaltyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getReferralStats', () => {
    it('should return referral code, shareable link, and earnings statistics', async () => {
      const res = await service.getReferralStats('user-1');

      expect(res.referralCode).toBe('ZEV-NOMAN-1234');
      expect(res.referralLink).toContain('ZEV-NOMAN-1234');
      expect(res.stats.totalFriendsInvited).toBe(3);
    });
  });

  describe('rewardReferralOnFirstOrder', () => {
    it('should award 50 points to both referrer and referee and dispatch reward email', async () => {
      const res = await service.rewardReferralOnFirstOrder(
        'user-2',
        'ZV-20260901-4892',
      );

      expect(res.rewarded).toBe(true);
      expect(res.pointsGiven).toBe(50);
      expect(loyaltyService.adjustPoints).toHaveBeenCalledTimes(2);
      expect(mailService.sendReferralRewardEmail).toHaveBeenCalledWith(
        'noman@example.com',
        expect.objectContaining({ rewardPoints: 50, rewardAmount: 500 }),
      );
      expect(prisma.referral.update).toHaveBeenCalled();
    });
  });
});
