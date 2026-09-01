/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { AbandonedCartController } from './abandoned-cart.controller.js';
import { AbandonedCartService } from './abandoned-cart.service.js';

describe('AbandonedCartController', () => {
  let controller: AbandonedCartController;
  let service: jest.Mocked<AbandonedCartService>;

  beforeEach(async () => {
    const serviceMock = {
      getAbandonedCartsList: jest
        .fn()
        .mockResolvedValue({ totalAbandoned: 2, carts: [] }),
      scanAndRecoverAbandonedCarts: jest.fn().mockResolvedValue({
        scannedCartsCount: 2,
        dispatchedRecoveryEmails: 2,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AbandonedCartController],
      providers: [{ provide: AbandonedCartService, useValue: serviceMock }],
    }).compile();

    controller = module.get<AbandonedCartController>(AbandonedCartController);
    service = module.get(AbandonedCartService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /abandoned-carts should delegate to service.getAbandonedCartsList', async () => {
    const res = await controller.getAbandonedCarts();
    expect(service.getAbandonedCartsList).toHaveBeenCalled();
    expect(res.totalAbandoned).toBe(2);
  });
});
