import { Test, TestingModule } from '@nestjs/testing';
import { PdfInvoiceService, InvoiceData } from './pdf-invoice.service.js';

describe('PdfInvoiceService', () => {
  let service: PdfInvoiceService;

  const mockInvoiceData: InvoiceData = {
    invoiceNumber: 'INV-20260901-1234',
    orderNumber: 'ZV-20260901-1234',
    orderDate: new Date('2026-09-01T12:00:00Z'),
    paymentStatus: 'PAID',
    paymentMethod: 'ONLINE',
    customer: {
      name: 'Mir Noman',
      email: 'noman@zevon.com',
      phone: '+8801700000000',
    },
    shippingAddress: {
      fullName: 'Mir Noman',
      phone: '+8801700000000',
      email: 'noman@zevon.com',
      addressLine1: 'House 12, Road 5',
      addressLine2: 'Block D, Banani',
      city: 'Dhaka',
      postalCode: '1213',
      country: 'Bangladesh',
    },
    items: [
      {
        serial: 1,
        productTitle: 'Premium Heavyweight Oversized Tee',
        sku: 'ZEV-TEE-BLK-L',
        color: 'Onyx Black',
        size: 'L',
        unitPrice: 1500,
        quantity: 2,
        lineTotal: 3000,
      },
    ],
    financials: {
      subtotal: 3000,
      discountAmount: 300,
      couponCode: 'ZEVON10',
      shippingCost: 60,
      totalAmount: 2760,
      currency: 'BDT',
    },
    courierName: 'Pathao Express',
    trackingNumber: 'PTH-987654321',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PdfInvoiceService],
    }).compile();

    service = module.get<PdfInvoiceService>(PdfInvoiceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate a valid binary PDF invoice buffer with PDF magic bytes', async () => {
    const pdfBuffer = await service.generateInvoicePdf(mockInvoiceData);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    // PDF Magic Bytes "%PDF-"
    const pdfHeader = pdfBuffer.subarray(0, 5).toString('ascii');
    expect(pdfHeader).toBe('%PDF-');
  });

  it('should generate invoice PDF correctly for Cash on Delivery (COD) and unpaid order', async () => {
    const codData: InvoiceData = {
      ...mockInvoiceData,
      paymentStatus: 'PENDING',
      paymentMethod: 'COD',
      financials: {
        ...mockInvoiceData.financials,
        discountAmount: 0,
        couponCode: null,
      },
    };

    const pdfBuffer = await service.generateInvoicePdf(codData);
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
  });
});
