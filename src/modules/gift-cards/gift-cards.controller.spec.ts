/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { GiftCardsController } from './gift-cards.controller.js';
import { GiftCardsService } from './gift-cards.service.js';

describe('GiftCardsController', () => {
  let controller: GiftCardsController;
  let service: jest.Mocked<GiftCardsService>;

  beforeEach(async () => {
    const serviceMock = {
      purchase: jest.fn().mockResolvedValue({
        code: 'ZEV-GIFT-1234-5678',
        initialBalance: 2000,
      }),
      checkBalance: jest.fn().mockResolvedValue({
        code: 'ZEV-GIFT-1234-5678',
        currentBalance: 2000,
        isValid: true,
      }),
      redeem: jest
        .fn()
        .mockResolvedValue({ amountDeducted: 1000, remainingBalance: 1000 }),
      findAll: jest.fn().mockResolvedValue({ giftCards: [], meta: {} }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GiftCardsController],
      providers: [{ provide: GiftCardsService, useValue: serviceMock }],
    }).compile();

    controller = module.get<GiftCardsController>(GiftCardsController);
    service = module.get(GiftCardsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('POST /gift-cards/check-balance should delegate to service.checkBalance', async () => {
    const dto = { code: 'ZEV-GIFT-1234-5678' };
    const res = await controller.checkBalance(dto);
    expect(service.checkBalance).toHaveBeenCalledWith(dto);
    expect(res.currentBalance).toBe(2000);
  });
});
