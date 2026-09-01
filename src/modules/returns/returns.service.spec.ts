import { Test, TestingModule } from '@nestjs/testing';
import { ReturnsService } from './returns.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderStatus, ReturnResolution, ReturnStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('ReturnsService', () => {
  let service: ReturnsService;
  let prisma: jest.Mocked<PrismaService>;

  const mockDeliveredOrder = {
    id: 'order-123',
    orderNumber: 'ZV-20260901-5678',
    userId: 'user-1',
    status: OrderStatus.DELIVERED,
    shippingAddress: {
      fullName: 'Mir Noman',
      phone: '01712345678',
      addressLine1: 'Road 1, House 2',
      city: 'Dhaka',
      postalCode: '1212',
    },
    user: {
      id: 'user-1',
      name: 'Mir Noman',
      email: 'noman@example.com',
      phone: '01712345678',
    },
    items: [
      {
        id: 'order-item-1',
        productId: 'prod-1',
        variantId: 'var-1',
        productTitle: 'Classic Shirt',
        sku: 'SHIRT-BLK-M',
        size: 'M',
        color: 'Black',
        unitPrice: new Decimal(1000),
        quantity: 1,
        totalPrice: new Decimal(1000),
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(), // Just delivered
  };

  beforeEach(async () => {
    const prismaMock = {
      order: {
        findUnique: jest.fn().mockResolvedValue(mockDeliveredOrder),
      },
      orderItem: {
        findUnique: jest.fn(),
      },
      productVariant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'var-exchange',
          size: 'L',
          color: 'Black',
          stock: 5,
          product: { isPublished: true },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      returnRequest: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'ret-123',
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
            orderItem: {
              productTitle: 'Classic Shirt',
              sku: 'SHIRT-BLK-M',
              size: 'M',
              color: 'Black',
              quantity: 1,
              totalPrice: new Decimal(1000),
            },
          }),
        ),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReturnsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ReturnsService>(ReturnsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create (Self-Service Return)', () => {
    it('should create return request with generated tracking reference', async () => {
      const result = await service.create('user-1', {
        orderId: 'order-123',
        orderItemId: 'order-item-1',
        reason: 'Size is too tight',
        resolution: ReturnResolution.REFUND,
      });

      expect(result.returnId).toBe('ret-123');
      expect(result.returnReference).toMatch(/^RET-\d{8}-\d{4}$/);
      expect(result.status).toBe(ReturnStatus.REQUESTED);
      expect(result.resolution).toBe(ReturnResolution.REFUND);
      expect(result.estimatedRefundAmount).toBe(1000);
    });

    it('should create EXCHANGE return request when exchangeVariant is in stock', async () => {
      const result = await service.create('user-1', {
        orderId: 'order-123',
        orderItemId: 'order-item-1',
        reason: 'Need larger size',
        resolution: ReturnResolution.EXCHANGE,
        exchangeVariantId: 'var-exchange',
      });

      expect(result.resolution).toBe(ReturnResolution.EXCHANGE);
      expect(result.estimatedRefundAmount).toBeNull();
    });

    it('should throw BadRequestException if order is not DELIVERED', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        ...mockDeliveredOrder,
        status: OrderStatus.PROCESSING,
      });

      await expect(
        service.create('user-1', {
          orderId: 'order-123',
          orderItemId: 'order-item-1',
          reason: 'Size issue',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if an active return already exists for the item', async () => {
      (prisma.returnRequest.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing-ret',
        returnReference: 'RET-20260901-1111',
        status: ReturnStatus.REQUESTED,
      });

      await expect(
        service.create('user-1', {
          orderId: 'order-123',
          orderItemId: 'order-item-1',
          reason: 'Duplicate attempt',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('trackReturn', () => {
    it('should track return by reference and email returning milestone steps', async () => {
      const mockReturn = {
        id: 'ret-123',
        returnReference: 'RET-20260901-4821',
        status: ReturnStatus.APPROVED,
        resolution: ReturnResolution.REFUND,
        reason: 'Defective zipper',
        proofImages: [],
        refundAmount: new Decimal(1000),
        pickupAddress: mockDeliveredOrder.shippingAddress,
        createdAt: new Date(),
        updatedAt: new Date(),
        order: mockDeliveredOrder,
        orderItem: mockDeliveredOrder.items[0],
      };

      (prisma.returnRequest.findUnique as jest.Mock).mockResolvedValue(
        mockReturn,
      );

      const result = await service.trackReturn({
        returnReference: 'RET-20260901-4821',
        emailOrPhone: 'noman@example.com',
      });

      expect(result.returnReference).toBe('RET-20260901-4821');
      expect(result.status).toBe(ReturnStatus.APPROVED);
      expect(result.steps).toHaveLength(4);
      expect(result.steps[0].completed).toBe(true);
      expect(result.steps[1].current).toBe(true);
    });

    it('should throw NotFoundException if email/phone does not match return', async () => {
      const mockReturn = {
        id: 'ret-123',
        returnReference: 'RET-20260901-4821',
        status: ReturnStatus.REQUESTED,
        pickupAddress: mockDeliveredOrder.shippingAddress,
        order: mockDeliveredOrder,
        orderItem: mockDeliveredOrder.items[0],
      };

      (prisma.returnRequest.findUnique as jest.Mock).mockResolvedValue(
        mockReturn,
      );

      await expect(
        service.trackReturn({
          returnReference: 'RET-20260901-4821',
          emailOrPhone: 'wrong@example.com',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Admin Return Workflows & Automated Restock', () => {
    const mockReturnWithItem = {
      id: 'ret-123',
      returnReference: 'RET-20260901-4821',
      status: ReturnStatus.REQUESTED,
      orderItem: {
        id: 'item-1',
        variantId: 'var-1',
        quantity: 2,
        sku: 'ZEV-TEE-BLK-M',
        unitPrice: new Decimal(1000),
        totalPrice: new Decimal(2000),
      },
      order: { orderNumber: 'ZV-20260901-4892' },
      user: { name: 'Mir Noman', email: 'noman@example.com' },
    };

    it('receiveReturn should update status to RECEIVED and automatically increment variant stock', async () => {
      (prisma.returnRequest.findUnique as jest.Mock).mockResolvedValue(
        mockReturnWithItem,
      );
      (prisma.returnRequest.update as jest.Mock).mockResolvedValue({
        ...mockReturnWithItem,
        status: ReturnStatus.RECEIVED,
      });

      const result = await service.receiveReturn(
        'ret-123',
        'Inspection passed. Items in original condition.',
      );

      expect(result.status).toBe(ReturnStatus.RECEIVED);
      expect(prisma.productVariant.update).toHaveBeenCalledWith({
        where: { id: 'var-1' },
        data: { stock: { increment: 2 } },
      });
    });

    it('approveReturn should transition status to APPROVED', async () => {
      (prisma.returnRequest.findUnique as jest.Mock).mockResolvedValue(
        mockReturnWithItem,
      );
      (prisma.returnRequest.update as jest.Mock).mockResolvedValue({
        ...mockReturnWithItem,
        status: ReturnStatus.APPROVED,
      });

      const result = await service.approveReturn(
        'ret-123',
        'Return accepted',
        'TRACK-123',
      );
      expect(result.status).toBe(ReturnStatus.APPROVED);
    });

    it('rejectReturn should throw BadRequestException if rejection reason is omitted', async () => {
      await expect(service.rejectReturn('ret-123', '')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
