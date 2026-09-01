/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service.js';
import { ConfigService } from '@nestjs/config';

describe('MailService', () => {
  let service: MailService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const configMock = {
      get: jest.fn((key: string, defaultVal?: unknown) => {
        if (key === 'mail.from') return 'ZEVON Store <no-reply@zevon.com>';
        return defaultVal;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate receipt HTML and handle sendOrderPaymentSuccessEmail gracefully in dev mode', async () => {
    const context = {
      orderNumber: 'ZV-20260901-1234',
      customerName: 'Mir Noman',
      customerEmail: 'noman@example.com',
      paymentMethod: 'Stripe (Credit / Debit Card)',
      transactionId: 'cs_test_123',
      subtotal: 2400,
      discountAmount: 400,
      shippingCost: 60,
      totalAmount: 2060,
      shippingAddress: {
        fullName: 'Mir Noman',
        phone: '01712345678',
        addressLine1: 'House 12, Road 5',
        city: 'Dhaka',
        postalCode: '1212',
        country: 'Bangladesh',
      },
      items: [
        {
          productTitle: 'Premium Cotton Shirt',
          sku: 'ZEV-SHT-BLK-L',
          color: 'Black',
          size: 'L',
          unitPrice: 1200,
          quantity: 2,
          totalPrice: 2400,
        },
      ],
      createdAt: new Date(),
    };

    const result = await service.sendOrderPaymentSuccessEmail(context);
    expect(result).toBe(true);
    expect(configService.get).toHaveBeenCalled();
  });

  it('should accept and attach pdfInvoiceBuffer when sending receipt email', async () => {
    const context = {
      orderNumber: 'ZV-20260901-1234',
      customerName: 'Mir Noman',
      customerEmail: 'noman@example.com',
      paymentMethod: 'COD',
      subtotal: 2000,
      discountAmount: 0,
      shippingCost: 60,
      totalAmount: 2060,
      shippingAddress: {
        fullName: 'Mir Noman',
        phone: '01712345678',
        addressLine1: 'House 12, Road 5',
        city: 'Dhaka',
      },
      items: [],
      createdAt: new Date(),
      pdfInvoiceBuffer: Buffer.from('%PDF-1.4 test invoice buffer'),
    };

    const result = await service.sendOrderPaymentSuccessEmail(context);
    expect(result).toBe(true);
  });
});
