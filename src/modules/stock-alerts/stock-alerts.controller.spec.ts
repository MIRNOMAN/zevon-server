/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { StockAlertsController } from './stock-alerts.controller.js';
import { StockAlertsService } from './stock-alerts.service.js';

describe('StockAlertsController', () => {
  let controller: StockAlertsController;
  let service: jest.Mocked<StockAlertsService>;

  beforeEach(async () => {
    const serviceMock = {
      subscribe: jest.fn().mockResolvedValue({ isAlreadyInStock: false, subscriptionId: 'alert-1' }),
      findMyAlerts: jest.fn().mockResolvedValue([]),
      cancelAlert: jest.fn().mockResolvedValue({ id: 'alert-1' }),
      findAll: jest.fn().mockResolvedValue({ alerts: [], meta: {} }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockAlertsController],
      providers: [{ provide: StockAlertsService, useValue: serviceMock }],
    }).compile();

    controller = module.get<StockAlertsController>(StockAlertsController);
    service = module.get(StockAlertsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('POST /stock-alerts/subscribe should delegate to service.subscribe', async () => {
    const dto = { productVariantId: 'var-1', email: 'test@example.com' };
    const res = await controller.subscribe(dto);
    expect(service.subscribe).toHaveBeenCalledWith(dto, undefined);
    expect(res.subscriptionId).toBe('alert-1');
  });
});
