import { Test, TestingModule } from '@nestjs/testing';
import { ShippingService } from './shipping.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { DeliveryType } from './dto/calculate-shipping.dto.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

describe('ShippingService', () => {
  let service: ShippingService;
  let prisma: jest.Mocked<PrismaService>;

  const mockZones = [
    {
      id: 'zone-inside-dhaka',
      name: 'Inside Dhaka City',
      code: 'INSIDE_DHAKA',
      description: 'Dhaka Metropolitan delivery',
      cities: ['Dhaka', 'Gulshan', 'Banani', 'Uttara', 'Mirpur'],
      postalCodes: ['1205', '1212', '1230'],
      cost: new Decimal(60.0),
      expressCost: new Decimal(130.0),
      freeShippingThreshold: new Decimal(2000.0),
      minOrderAmount: new Decimal(0.0),
      estimatedDeliveryDays: '1-2 Business Days',
      expressDeliveryDays: 'Same-Day (4-6 Hours)',
      isDefault: false,
      isActive: true,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: { orders: 5 },
    },
    {
      id: 'zone-dhaka-suburbs',
      name: 'Dhaka Suburbs',
      code: 'DHAKA_SUBURBS',
      description: 'Gazipur, Narayanganj, Savar',
      cities: ['Gazipur', 'Narayanganj', 'Savar'],
      postalCodes: ['1700', '1400', '1340'],
      cost: new Decimal(90.0),
      expressCost: new Decimal(180.0),
      freeShippingThreshold: new Decimal(2500.0),
      minOrderAmount: new Decimal(0.0),
      estimatedDeliveryDays: '2-3 Business Days',
      expressDeliveryDays: 'Next-Day Express',
      isDefault: false,
      isActive: true,
      sortOrder: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: { orders: 2 },
    },
    {
      id: 'zone-outside-dhaka',
      name: 'Outside Dhaka (All Bangladesh)',
      code: 'OUTSIDE_DHAKA',
      description: 'Nationwide delivery',
      cities: ['Chittagong', 'Sylhet', 'Rajshahi', 'Khulna'],
      postalCodes: [],
      cost: new Decimal(120.0),
      expressCost: null,
      freeShippingThreshold: new Decimal(3500.0),
      minOrderAmount: new Decimal(0.0),
      estimatedDeliveryDays: '3-5 Business Days',
      expressDeliveryDays: null,
      isDefault: true,
      isActive: true,
      sortOrder: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: { orders: 10 },
    },
  ];

  beforeEach(async () => {
    const prismaMock = {
      shippingZone: {
        findMany: jest.fn().mockResolvedValue(mockZones),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        count: jest.fn().mockResolvedValue(3),
      },
      cart: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShippingService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<ShippingService>(ShippingService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateShipping', () => {
    it('should match Inside Dhaka zone via postal code "1212" and return standard rate for subtotal < 2000', async () => {
      const result = await service.calculateShipping(undefined, {
        postalCode: '1212',
        cartSubtotal: 1500,
      });

      expect(result.shippingZone.code).toBe('INSIDE_DHAKA');
      expect(result.matchReason).toBe('POSTAL_CODE');
      expect(result.shippingCost).toBe(60);
      expect(result.cartSubtotal).toBe(1500);
      expect(result.finalTotal).toBe(1560);
      expect(result.freeShipping.isFreeShipping).toBe(false);
      expect(result.freeShipping.amountNeeded).toBe(500);
      expect(result.freeShipping.progressPercent).toBe(75);
      expect(result.availableRates).toHaveLength(2);
    });

    it('should unlock FREE standard shipping when cart subtotal >= freeShippingThreshold (2000 BDT)', async () => {
      const result = await service.calculateShipping(undefined, {
        city: 'Dhaka',
        cartSubtotal: 2500,
        deliveryType: DeliveryType.STANDARD,
      });

      expect(result.shippingZone.code).toBe('INSIDE_DHAKA');
      expect(result.matchReason).toBe('CITY');
      expect(result.shippingCost).toBe(0);
      expect(result.finalTotal).toBe(2500);
      expect(result.freeShipping.isFreeShipping).toBe(true);
      expect(result.freeShipping.amountNeeded).toBe(0);
      expect(result.freeShipping.progressPercent).toBe(100);
    });

    it('should apply express delivery rate when deliveryType is EXPRESS', async () => {
      const result = await service.calculateShipping(undefined, {
        city: 'Gulshan',
        cartSubtotal: 2500,
        deliveryType: DeliveryType.EXPRESS,
      });

      expect(result.shippingZone.code).toBe('INSIDE_DHAKA');
      expect(result.selectedDeliveryType).toBe(DeliveryType.EXPRESS);
      expect(result.shippingCost).toBe(130);
      expect(result.finalTotal).toBe(2630);
    });

    it('should fallback to default zone (Outside Dhaka) when unlisted city is passed', async () => {
      const result = await service.calculateShipping(undefined, {
        city: 'Cox\'s Bazar',
        cartSubtotal: 1000,
      });

      expect(result.shippingZone.code).toBe('OUTSIDE_DHAKA');
      expect(result.matchReason).toBe('DEFAULT_ZONE');
      expect(result.shippingCost).toBe(120);
      expect(result.freeShipping.isFreeShipping).toBe(false);
      expect(result.freeShipping.threshold).toBe(3500);
      expect(result.freeShipping.amountNeeded).toBe(2500);
    });

    it('should match zone directly by shippingZoneId', async () => {
      const result = await service.calculateShipping(undefined, {
        shippingZoneId: 'zone-dhaka-suburbs',
        cartSubtotal: 1200,
      });

      expect(result.shippingZone.id).toBe('zone-dhaka-suburbs');
      expect(result.matchReason).toBe('DIRECT_ID');
      expect(result.shippingCost).toBe(90);
    });

    it('should pull cart subtotal from database if user is authenticated and cartSubtotal is omitted', async () => {
      (prisma.cart.findUnique as jest.Mock).mockResolvedValue({
        id: 'cart-123',
        userId: 'user-1',
        items: [
          {
            quantity: 2,
            variant: {
              extraPrice: new Decimal(0),
              product: {
                basePrice: new Decimal(1000),
                discountPrice: null,
              },
            },
          },
        ],
      });

      const result = await service.calculateShipping('user-1', {
        city: 'Dhaka',
      });

      expect(result.cartSubtotal).toBe(2000);
      expect(result.freeShipping.isFreeShipping).toBe(true);
      expect(result.shippingCost).toBe(0);
    });

    it('should throw NotFoundException if no active shipping zones exist', async () => {
      (prisma.shippingZone.findMany as jest.Mock).mockResolvedValue([]);

      await expect(
        service.calculateShipping(undefined, { city: 'Dhaka' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('admin CRUD & zone management', () => {
    it('findAllPublic should return active zones with numeric values', async () => {
      const publicZones = await service.findAllPublic();
      expect(publicZones).toHaveLength(3);
      expect(typeof publicZones[0].cost).toBe('number');
    });

    it('create should enforce unique code and unset previous defaults if isDefault is true', async () => {
      (prisma.shippingZone.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.shippingZone.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ id: 'zone-new', ...data }),
      );

      const created = await service.create({
        name: 'Sylhet Special Zone',
        code: 'SYLHET_ZONE',
        cost: 100,
        estimatedDeliveryDays: '2-3 Days',
        isDefault: true,
      });

      expect(prisma.shippingZone.updateMany).toHaveBeenCalledWith({
        where: { isDefault: true },
        data: { isDefault: false },
      });
      expect(created.code).toBe('SYLHET_ZONE');
    });

    it('remove should block deletion if shipping zone has linked orders', async () => {
      (prisma.shippingZone.findUnique as jest.Mock).mockResolvedValue(mockZones[0]);

      await expect(service.remove('zone-inside-dhaka')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
