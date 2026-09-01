/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { LoyaltyController } from './loyalty.controller.js';
import { LoyaltyService } from './loyalty.service.js';
import { CustomerTier } from '@prisma/client';

describe('LoyaltyController', () => {
  let controller: LoyaltyController;
  let service: jest.Mocked<LoyaltyService>;

  beforeEach(async () => {
    const serviceMock = {
      getAccount: jest
        .fn()
        .mockResolvedValue({ pointsBalance: 150, tier: CustomerTier.SILVER }),
      redeemPoints: jest
        .fn()
        .mockResolvedValue({ pointsRedeemed: 50, discountAmountBDT: 50 }),
      adjustPoints: jest.fn().mockResolvedValue({ newBalance: 200 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoyaltyController],
      providers: [{ provide: LoyaltyService, useValue: serviceMock }],
    }).compile();

    controller = module.get<LoyaltyController>(LoyaltyController);
    service = module.get(LoyaltyService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /loyalty/my-account should delegate to service.getAccount', async () => {
    const res = await controller.getMyAccount('user-1');
    expect(service.getAccount).toHaveBeenCalledWith('user-1');
    expect(res.pointsBalance).toBe(150);
  });
});
