import { Test, TestingModule } from '@nestjs/testing';
import {
  ShippingLabelService,
  ShippingLabelData,
} from './shipping-label.service.js';

describe('ShippingLabelService', () => {
  let service: ShippingLabelService;

  const mockLabelData: ShippingLabelData = {
    orderNumber: 'ZV-20260901-1234',
    trackingNumber: 'PTH-987654321',
    courierName: 'Pathao Express',
    shippingZoneName: 'Inside Dhaka Express',
    recipient: {
      fullName: 'Mir Noman',
      phone: '+8801700000000',
      email: 'noman@zevon.com',
      addressLine1: 'House 12, Road 5, Block D',
      city: 'Dhaka',
      postalCode: '1213',
    },
    sender: {
      companyName: 'ZEVON Lifestyle Limited',
      hubName: 'Banani Central Hub',
      address: 'House 42, Road 11, Banani',
      city: 'Dhaka-1213',
      phone: '+880 9612-000000',
    },
    paymentMethod: 'COD',
    paymentStatus: 'PENDING',
    codAmount: 2760,
    totalItemsCount: 2,
    createdAt: new Date('2026-09-01T12:00:00Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ShippingLabelService],
    }).compile();

    service = module.get<ShippingLabelService>(ShippingLabelService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate a 4x6" thermal printable shipping label PDF with barcodes', async () => {
    const pdfBuffer = await service.generateShippingLabelPdf(mockLabelData);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(500);
    const pdfHeader = pdfBuffer.subarray(0, 5).toString('ascii');
    expect(pdfHeader).toBe('%PDF-');
  });

  it('should generate multi-page bulk shipping labels PDF for warehouse batch printing', async () => {
    const bulkData: ShippingLabelData[] = [
      mockLabelData,
      {
        ...mockLabelData,
        orderNumber: 'ZV-20260901-5678',
        trackingNumber: 'STF-11223344',
        courierName: 'Steadfast Courier',
        paymentMethod: 'ONLINE',
        paymentStatus: 'PAID',
        codAmount: 0,
      },
    ];

    const pdfBuffer = await service.generateBulkShippingLabelsPdf(bulkData);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    const pdfHeader = pdfBuffer.subarray(0, 5).toString('ascii');
    expect(pdfHeader).toBe('%PDF-');
  });

  it('should throw an error if bulk labels array is empty', async () => {
    await expect(service.generateBulkShippingLabelsPdf([])).rejects.toThrow(
      'At least one shipping label payload is required',
    );
  });
});
