/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ReferralsController } from './referrals.controller.js';
import { ReferralsService } from './referrals.service.js';

describe('ReferralsController', () => {
  let controller: ReferralsController;
  let service: jest.Mocked<ReferralsService>;

  beforeEach(async () => {
    const serviceMock = {
      getReferralStats: jest
        .fn()
        .mockResolvedValue({ referralCode: 'ZEV-NOMAN-1234' }),
      applyReferralCode: jest.fn().mockResolvedValue({ applied: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReferralsController],
      providers: [{ provide: ReferralsService, useValue: serviceMock }],
    }).compile();

    controller = module.get<ReferralsController>(ReferralsController);
    service = module.get(ReferralsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /referrals/my-stats should delegate to service.getReferralStats', async () => {
    const res = await controller.getMyStats('user-1');
    expect(service.getReferralStats).toHaveBeenCalledWith('user-1');
    expect(res.referralCode).toBe('ZEV-NOMAN-1234');
  });
});
