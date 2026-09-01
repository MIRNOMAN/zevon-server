/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ReturnsController } from './returns.controller.js';
import { ReturnsService } from './returns.service.js';
import { ReturnResolution, ReturnStatus } from '@prisma/client';

describe('ReturnsController', () => {
  let controller: ReturnsController;
  let service: jest.Mocked<ReturnsService>;

  const mockReturnResponse = {
    returnId: 'ret-1',
    returnReference: 'RET-20260901-4821',
    status: ReturnStatus.REQUESTED,
    resolution: ReturnResolution.REFUND,
    reason: 'Wrong size',
    proofImages: [],
    estimatedRefundAmount: 1000,
    orderNumber: 'ZV-20260901-1234',
    item: {
      productTitle: 'Shirt',
      sku: 'SHIRT-M',
      size: 'M',
      color: 'Black',
      quantity: 1,
      totalPrice: 1000,
    },
    pickupAddress: {},
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const serviceMock = {
      create: jest.fn().mockResolvedValue(mockReturnResponse),
      trackReturn: jest
        .fn()
        .mockResolvedValue({ returnReference: 'RET-20260901-4821', steps: [] }),
      findMyReturns: jest.fn().mockResolvedValue({ returns: [], meta: {} }),
      findMyReturnById: jest.fn().mockResolvedValue(mockReturnResponse),
      findAll: jest.fn().mockResolvedValue({ returns: [], meta: {} }),
      findOne: jest.fn().mockResolvedValue(mockReturnResponse),
      updateStatus: jest
        .fn()
        .mockResolvedValue({ status: ReturnStatus.APPROVED }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReturnsController],
      providers: [{ provide: ReturnsService, useValue: serviceMock }],
    }).compile();

    controller = module.get<ReturnsController>(ReturnsController);
    service = module.get(ReturnsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('POST /returns should delegate to service.create', async () => {
    const dto = {
      orderId: 'order-1',
      orderItemId: 'item-1',
      reason: 'Wrong size',
      resolution: ReturnResolution.REFUND,
    };

    const res = await controller.create('user-1', dto);
    expect(service.create).toHaveBeenCalledWith('user-1', dto);
    expect(res).toEqual(mockReturnResponse);
  });

  it('POST /returns/track should delegate to service.trackReturn', async () => {
    const dto = {
      returnReference: 'RET-20260901-4821',
      emailOrPhone: 'noman@example.com',
    };

    const res = await controller.trackReturn(dto);
    expect(service.trackReturn).toHaveBeenCalledWith(dto);
    expect(res.returnReference).toBe('RET-20260901-4821');
  });
});
