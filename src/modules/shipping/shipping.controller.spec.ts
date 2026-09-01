/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ShippingController } from './shipping.controller.js';
import { ShippingService } from './shipping.service.js';
import { DeliveryType } from './dto/calculate-shipping.dto.js';

describe('ShippingController', () => {
  let controller: ShippingController;
  let service: jest.Mocked<ShippingService>;

  const mockCalculationResult = {
    shippingZone: {
      id: 'zone-1',
      name: 'Inside Dhaka City',
      code: 'INSIDE_DHAKA',
      description: 'Dhaka Metropolitan delivery',
      estimatedDeliveryDays: '1-2 Business Days',
      expressDeliveryDays: 'Same-Day (4-6 Hours)',
      isDefault: false,
    },
    matchReason: 'POSTAL_CODE' as const,
    selectedDeliveryType: DeliveryType.STANDARD,
    shippingCost: 60,
    cartSubtotal: 1500,
    finalTotal: 1560,
    freeShipping: {
      isFreeShipping: false,
      threshold: 2000,
      amountNeeded: 500,
      progressPercent: 75,
      message: 'Add ৳500.00 more to your cart to get FREE standard delivery!',
    },
    availableRates: [
      {
        type: DeliveryType.STANDARD,
        name: 'Standard Delivery',
        baseRate: 60,
        finalRate: 60,
        isFree: false,
        estimatedDeliveryDays: '1-2 Business Days',
        description: 'Delivery within 1-2 Business Days',
      },
    ],
  };

  beforeEach(async () => {
    const serviceMock = {
      calculateShipping: jest.fn().mockResolvedValue(mockCalculationResult),
      findAllPublic: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      toggleStatus: jest.fn(),
      setDefault: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShippingController],
      providers: [
        {
          provide: ShippingService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<ShippingController>(ShippingController);
    service = module.get(ShippingService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('POST /shipping/calculate should delegate to service.calculateShipping', async () => {
    const dto = { postalCode: '1212', cartSubtotal: 1500 };
    const res = await controller.calculateShipping('user-1', dto);

    expect(service.calculateShipping).toHaveBeenCalledWith('user-1', dto);
    expect(res).toEqual(mockCalculationResult);
  });

  it('GET /shipping/public should delegate to service.findAllPublic', async () => {
    await controller.findAllPublic();
    expect(service.findAllPublic).toHaveBeenCalled();
  });
});
