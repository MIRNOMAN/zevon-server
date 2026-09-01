/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { BadRequestException } from '@nestjs/common';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let service: jest.Mocked<PaymentsService>;

  const mockSessionResponse = {
    sessionId: 'cs_test_123',
    sessionUrl: 'https://checkout.stripe.com/pay/cs_test_123',
    orderId: 'order-1',
    orderNumber: 'ZV-20260901-1234',
    totalAmount: 2060,
    currency: 'bdt',
  };

  beforeEach(async () => {
    const serviceMock = {
      createCheckoutSession: jest.fn().mockResolvedValue(mockSessionResponse),
      handleWebhook: jest.fn().mockResolvedValue({ received: true }),
      getStripeConfig: jest.fn().mockReturnValue({ publishableKey: 'pk_test_123', currency: 'bdt' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        { provide: PaymentsService, useValue: serviceMock },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
    service = module.get(PaymentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('POST /payments/checkout-session should delegate to service.createCheckoutSession', async () => {
    const dto = { orderId: 'order-1' };
    const res = await controller.createCheckoutSession('user-1', dto);

    expect(service.createCheckoutSession).toHaveBeenCalledWith('user-1', dto);
    expect(res).toEqual(mockSessionResponse);
  });

  it('POST /payments/webhook should delegate to service.handleWebhook with rawBody', async () => {
    const rawBuffer = Buffer.from('mock-raw-body');
    const reqMock: any = { rawBody: rawBuffer };

    const res = await controller.handleWebhook('sig-123', reqMock);
    expect(service.handleWebhook).toHaveBeenCalledWith(rawBuffer, 'sig-123');
    expect(res).toEqual({ received: true });
  });

  it('POST /payments/webhook should throw BadRequestException if rawBody is missing', async () => {
    const reqMock: any = {};
    await expect(controller.handleWebhook('sig-123', reqMock)).rejects.toThrow(BadRequestException);
  });

  it('GET /payments/config should return stripe config', () => {
    const config = controller.getStripeConfig();
    expect(config).toEqual({ publishableKey: 'pk_test_123', currency: 'bdt' });
  });
});
