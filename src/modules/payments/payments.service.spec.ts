import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: jest.Mocked<PrismaService>;
  let mailService: jest.Mocked<MailService>;

  const mockOrder = {
    id: 'order-123',
    orderNumber: 'ZV-20260901-5678',
    userId: 'user-1',
    status: OrderStatus.PENDING,
    paymentStatus: PaymentStatus.PENDING,
    paymentMethod: PaymentMethod.COD,
    subtotal: new Decimal(2000),
    discountAmount: new Decimal(0),
    shippingCost: new Decimal(60),
    totalAmount: new Decimal(2060),
    shippingAddress: {
      fullName: 'Mir Noman',
      phone: '+8801700000000',
      addressLine1: 'Road 1, House 2',
      city: 'Dhaka',
      postalCode: '1212',
      country: 'Bangladesh',
    },
    user: {
      id: 'user-1',
      name: 'Mir Noman',
      email: 'noman@example.com',
      phone: '+8801700000000',
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
        quantity: 2,
        totalPrice: new Decimal(2000),
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const prismaMock = {
      order: {
        findUnique: jest.fn().mockResolvedValue(mockOrder),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...mockOrder,
            ...data,
          }),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const mailServiceMock = {
      sendOrderPaymentSuccessEmail: jest.fn().mockResolvedValue(true),
    };

    const configServiceMock = {
      get: jest.fn((key: string, defaultVal?: unknown) => {
        if (key === 'stripe.secretKey') return 'sk_test_mock_key';
        if (key === 'stripe.webhookSecret') return 'whsec_mock_key';
        if (key === 'stripe.publishableKey') return 'pk_test_mock_key';
        if (key === 'stripe.currency') return 'bdt';
        if (key === 'stripe.successUrl')
          return 'http://localhost:3000/order/success?session_id={CHECKOUT_SESSION_ID}';
        if (key === 'stripe.cancelUrl')
          return 'http://localhost:3000/order/cancel';
        return defaultVal;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: MailService, useValue: mailServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    prisma = module.get(PrismaService);
    mailService = module.get(MailService);

    // Mock Stripe instance methods
    (service as any).stripe = {
      checkout: {
        sessions: {
          create: jest.fn().mockResolvedValue({
            id: 'cs_test_session_123',
            url: 'https://checkout.stripe.com/pay/cs_test_session_123',
          }),
        },
      },
      webhooks: {
        constructEvent: jest.fn(),
      },
    };
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCheckoutSession', () => {
    it('should create Stripe checkout session with line items and metadata', async () => {
      const result = await service.createCheckoutSession('user-1', {
        orderId: 'order-123',
      });

      expect(result.sessionId).toBe('cs_test_session_123');
      expect(result.sessionUrl).toBe(
        'https://checkout.stripe.com/pay/cs_test_session_123',
      );
      expect(result.orderNumber).toBe('ZV-20260901-5678');
      expect(result.totalAmount).toBe(2060);
      expect(
        (service as any).stripe.checkout.sessions.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_email: 'noman@example.com',
          client_reference_id: 'order-123',
          metadata: expect.objectContaining({
            orderId: 'order-123',
            orderNumber: 'ZV-20260901-5678',
            userId: 'user-1',
          }),
        }),
      );
    });

    it('should throw NotFoundException if order does not exist', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createCheckoutSession('user-1', { orderId: 'non-existent' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if order is already paid', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        paymentStatus: PaymentStatus.PAID,
      });

      await expect(
        service.createCheckoutSession('user-1', { orderId: 'order-123' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleWebhook', () => {
    it('should handle checkout.session.completed, update order to PAID and send email receipt', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_session_123',
            metadata: {
              orderId: 'order-123',
            },
            customer_details: {
              email: 'noman@example.com',
            },
          },
        },
      };

      (service as any).stripe.webhooks.constructEvent.mockReturnValue(
        mockEvent,
      );

      const buffer = Buffer.from('mock-raw-body');
      const response = await service.handleWebhook(buffer, 'valid-signature');

      expect(response.received).toBe(true);
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-123' },
        data: expect.objectContaining({
          paymentStatus: PaymentStatus.PAID,
          paymentMethod: PaymentMethod.STRIPE,
        }),
        include: expect.anything(),
      });
      expect(mailService.sendOrderPaymentSuccessEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          orderNumber: 'ZV-20260901-5678',
          customerEmail: 'noman@example.com',
          paymentMethod: 'Stripe (Credit / Debit Card)',
        }),
      );
    });

    it('should handle payment_intent.payment_failed and update order to FAILED', async () => {
      const mockEvent = {
        id: 'evt_456',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_test_123',
            metadata: {
              orderId: 'order-123',
            },
          },
        },
      };

      (service as any).stripe.webhooks.constructEvent.mockReturnValue(
        mockEvent,
      );

      const buffer = Buffer.from('mock-raw-body');
      const response = await service.handleWebhook(buffer, 'valid-signature');

      expect(response.received).toBe(true);
      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: 'order-123', paymentStatus: { not: PaymentStatus.PAID } },
        data: { paymentStatus: PaymentStatus.FAILED },
      });
    });

    it('should throw BadRequestException if signature is invalid', async () => {
      (service as any).stripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Signature verification failed');
      });

      const buffer = Buffer.from('mock-raw-body');
      await expect(
        service.handleWebhook(buffer, 'invalid-signature'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
