import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { ShippingService } from '../shipping/shipping.service.js';
import { CouponsService } from '../coupons/coupons.service.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  DiscountType,
} from '@prisma/client';

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

  describe('trackOrder', () => {
    it('should return shipment stepper milestones for valid order number and email', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ZV-20260901-4892',
        status: OrderStatus.SHIPPED,
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: PaymentMethod.STRIPE,
        subtotal: new Decimal(2000),
        discountAmount: new Decimal(0),
        shippingCost: new Decimal(60),
        totalAmount: new Decimal(2060),
        shippingAddress: {
          fullName: 'Mir Noman',
          phone: '01712345678',
          email: 'noman@example.com',
          city: 'Dhaka',
        },
        user: {
          name: 'Mir Noman',
          email: 'noman@example.com',
          phone: '01712345678',
        },
        items: [],
        shippingZone: {
          name: 'Inside Dhaka City',
          estimatedDeliveryDays: '1-2 Days',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      const result = await service.trackOrder({
        orderNumber: 'ZV-20260901-4892',
        emailOrPhone: 'noman@example.com',
      });

      expect(result.orderNumber).toBe('ZV-20260901-4892');
      expect(result.status).toBe(OrderStatus.SHIPPED);
      expect(result.currentStepIndex).toBe(3);
      expect(result.steps).toHaveLength(5);
      expect(result.steps[0].completed).toBe(true); // PENDING
      expect(result.steps[1].completed).toBe(true); // CONFIRMED
      expect(result.steps[2].completed).toBe(true); // PROCESSING
      expect(result.steps[3].current).toBe(true); // SHIPPED
    });

    it('should throw NotFoundException if order number is invalid', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.trackOrder({
          orderNumber: 'INVALID-ORDER',
          emailOrPhone: 'noman@example.com',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Admin Operations', () => {
    it('assignCourier should update courier name, tracking number, and set status to SHIPPED', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ZV-20260901-4892',
        status: OrderStatus.PROCESSING,
        shippingAddress: {},
        items: [],
      };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.order.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        courierName: 'Pathao Courier',
        trackingNumber: 'PTH-12345',
        status: OrderStatus.SHIPPED,
      });

      const result = await service.assignCourier('order-1', {
        courierName: 'Pathao Courier',
        trackingNumber: 'PTH-12345',
      });

      expect(result.courierName).toBe('Pathao Courier');
      expect(result.trackingNumber).toBe('PTH-12345');
      expect(result.status).toBe(OrderStatus.SHIPPED);
    });

    it('generateInvoice should produce structured printable invoice JSON with company branding', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ZV-20260901-4892',
        status: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: PaymentMethod.STRIPE,
        subtotal: new Decimal(2000),
        discountAmount: new Decimal(200),
        shippingCost: new Decimal(60),
        totalAmount: new Decimal(1860),
        shippingAddress: { fullName: 'Mir Noman', city: 'Dhaka' },
        user: {
          name: 'Mir Noman',
          email: 'noman@example.com',
          phone: '01712345678',
        },
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            productTitle: 'Shirt',
            sku: 'SHIRT-M',
            size: 'M',
            color: 'Black',
            unitPrice: new Decimal(2000),
            quantity: 1,
            totalPrice: new Decimal(2000),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      const invoice = await service.generateInvoice('order-1');

      expect(invoice.invoiceNumber).toBe('INV-20260901-4892');
      expect(invoice.company.name).toBe('ZEVON Official Ltd.');
      expect(invoice.financials.totalAmount).toBe(1860);
      expect(invoice.lineItems).toHaveLength(1);
    });

    it('getMetricsSummary should aggregate revenue and count orders by status', async () => {
      const metrics = await service.getMetricsSummary();
      expect(metrics.totalRevenue).toBe(5000);
      expect(metrics.averageOrderValue).toBe(2500);
      expect(metrics.totalOrders).toBe(1);
    });
  });
});
