import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { ShippingService } from '../shipping/shipping.service.js';
import { CouponsService } from '../coupons/coupons.service.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { OrderStatus, PaymentMethod, PaymentStatus, DiscountType } from '@prisma/client';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: jest.Mocked<PrismaService>;
  let shippingService: jest.Mocked<ShippingService>;
  let couponsService: jest.Mocked<CouponsService>;

  const mockCart = {
    id: 'cart-1',
    userId: 'user-1',
    items: [
      {
        id: 'cart-item-1',
        cartId: 'cart-1',
        productVariantId: 'variant-1',
        quantity: 2,
        variant: {
          id: 'variant-1',
          sku: 'ZEV-TSHIRT-BLK-M',
          color: 'Black',
          size: 'M',
          stock: 10,
          extraPrice: new Decimal(0),
          product: {
            id: 'product-1',
            title: 'Classic Cotton T-Shirt',
            basePrice: new Decimal(1200),
            discountPrice: new Decimal(1000),
            isPublished: true,
          },
        },
      },
    ],
  };

  const mockAddressSnapshot = {
    fullName: 'Mir Noman',
    phone: '+8801700000000',
    addressLine1: 'Road 5, House 12',
    city: 'Dhaka',
    postalCode: '1212',
    country: 'Bangladesh',
  };

  const mockShippingCalc = {
    shippingZone: {
      id: 'zone-inside-dhaka',
      name: 'Inside Dhaka City',
      estimatedDeliveryDays: '1-2 Business Days',
      expressDeliveryDays: 'Same-Day',
    },
    shippingCost: 60,
    cartSubtotal: 2000,
    finalTotal: 2060,
    matchReason: 'POSTAL_CODE' as const,
    selectedDeliveryType: 'STANDARD' as any,
    freeShipping: {
      isFreeShipping: false,
      threshold: 3000,
      amountNeeded: 1000,
      progressPercent: 67,
      message: '',
    },
    availableRates: [],
  };

  beforeEach(async () => {
    const prismaMock = {
      cart: {
        findUnique: jest.fn().mockResolvedValue(mockCart),
      },
      cartItem: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      address: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(mockAddressSnapshot),
      },
      productVariant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'variant-1',
          stock: 10,
          sku: 'ZEV-TSHIRT-BLK-M',
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      coupon: {
        update: jest.fn().mockResolvedValue({}),
      },
      order: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'order-1',
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
            items: [
              {
                id: 'order-item-1',
                productId: 'product-1',
                variantId: 'variant-1',
                productTitle: 'Classic Cotton T-Shirt',
                sku: 'ZEV-TSHIRT-BLK-M',
                size: 'M',
                color: 'Black',
                unitPrice: new Decimal(1000),
                quantity: 2,
                totalPrice: new Decimal(2000),
              },
            ],
            shippingZone: {
              id: 'zone-inside-dhaka',
              name: 'Inside Dhaka City',
              estimatedDeliveryDays: '1-2 Business Days',
              expressDeliveryDays: 'Same-Day',
            },
            coupon: null,
          }),
        ),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({
          _sum: { totalAmount: new Decimal(5000) },
          _avg: { totalAmount: new Decimal(2500) },
        }),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prismaMock)),
    };

    const shippingMock = {
      calculateShipping: jest.fn().mockResolvedValue(mockShippingCalc),
    };

    const couponsMock = {
      validateCoupon: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ShippingService, useValue: shippingMock },
        { provide: CouponsService, useValue: couponsMock },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prisma = module.get(PrismaService);
    shippingService = module.get(ShippingService);
    couponsService = module.get(CouponsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkout', () => {
    it('should complete atomic checkout, calculate rates, decrement stock, and clear cart', async () => {
      const result = await service.checkout('user-1', {
        shippingAddress: mockAddressSnapshot,
        paymentMethod: PaymentMethod.COD,
      });

      expect(result.orderId).toBe('order-1');
      expect(result.status).toBe(OrderStatus.PENDING);
      expect(result.subtotal).toBe(2000);
      expect(result.shippingCost).toBe(60);
      expect(result.totalAmount).toBe(2060);
      expect(prisma.productVariant.update).toHaveBeenCalledWith({
        where: { id: 'variant-1' },
        data: { stock: { decrement: 2 } },
      });
      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'cart-1' },
      });
    });

    it('should apply valid coupon discount during checkout and increment coupon usage', async () => {
      couponsService.validateCoupon.mockResolvedValue({
        valid: true,
        couponId: 'coupon-1',
        code: 'ZEVON20',
        description: '20% off',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 20,
        cartSubtotal: 2000,
        discountAmount: 400,
        finalTotal: 1600,
        savingsMessage: 'Saved ৳400',
      });

      const result = await service.checkout('user-1', {
        shippingAddress: mockAddressSnapshot,
        couponCode: 'ZEVON20',
      });

      expect(result.discountAmount).toBe(400);
      expect(result.totalAmount).toBe(1660); // 2000 - 400 + 60 = 1660
      expect(prisma.coupon.update).toHaveBeenCalledWith({
        where: { id: 'coupon-1' },
        data: { usedCount: { increment: 1 } },
      });
    });

    it('should throw BadRequestException if shopping cart is empty', async () => {
      (prisma.cart.findUnique as jest.Mock).mockResolvedValue({
        id: 'cart-empty',
        userId: 'user-1',
        items: [],
      });

      await expect(
        service.checkout('user-1', { shippingAddress: mockAddressSnapshot }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if item is out of stock in cart', async () => {
      (prisma.cart.findUnique as jest.Mock).mockResolvedValue({
        id: 'cart-1',
        userId: 'user-1',
        items: [
          {
            quantity: 20,
            variant: {
              id: 'variant-1',
              stock: 5,
              extraPrice: new Decimal(0),
              product: {
                title: 'Shirt',
                basePrice: new Decimal(1000),
                discountPrice: null,
                isPublished: true,
              },
            },
          },
        ],
      });

      await expect(
        service.checkout('user-1', { shippingAddress: mockAddressSnapshot }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if stock changes concurrently during transaction', async () => {
      (prisma.productVariant.findUnique as jest.Mock).mockResolvedValue({
        id: 'variant-1',
        stock: 1, // Only 1 left but requested 2!
        sku: 'ZEV-TSHIRT-BLK-M',
      });

      await expect(
        service.checkout('user-1', { shippingAddress: mockAddressSnapshot }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelMyOrder', () => {
    it('should cancel pending order and restore variant inventory and coupon usage', async () => {
      const mockOrder = {
        id: 'order-1',
        userId: 'user-1',
        status: OrderStatus.PENDING,
        couponId: 'coupon-1',
        items: [
          {
            variantId: 'variant-1',
            quantity: 2,
            product: { images: [] },
          },
        ],
        subtotal: new Decimal(2000),
        discountAmount: new Decimal(400),
        shippingCost: new Decimal(60),
        totalAmount: new Decimal(1660),
      };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.order.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CANCELLED,
      });

      const cancelled = await service.cancelMyOrder('user-1', 'order-1');
      expect(cancelled.status).toBe(OrderStatus.CANCELLED);
      expect(prisma.productVariant.update).toHaveBeenCalledWith({
        where: { id: 'variant-1' },
        data: { stock: { increment: 2 } },
      });
      expect(prisma.coupon.update).toHaveBeenCalledWith({
        where: { id: 'coupon-1' },
        data: { usedCount: { decrement: 1 } },
      });
    });

    it('should reject cancellation if order status is not PENDING (e.g. PROCESSING)', async () => {
      const mockOrder = {
        id: 'order-1',
        userId: 'user-1',
        status: OrderStatus.PROCESSING,
        items: [],
        subtotal: new Decimal(2000),
        discountAmount: new Decimal(0),
        shippingCost: new Decimal(60),
        totalAmount: new Decimal(2060),
      };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      await expect(service.cancelMyOrder('user-1', 'order-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Admin Operations', () => {
    it('getMetricsSummary should aggregate revenue and count orders by status', async () => {
      const metrics = await service.getMetricsSummary();
      expect(metrics.totalRevenue).toBe(5000);
      expect(metrics.averageOrderValue).toBe(2500);
      expect(metrics.totalOrders).toBe(1);
    });
  });
});
