/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';

describe('OrdersController', () => {
  let controller: OrdersController;
  let service: jest.Mocked<OrdersService>;

  const mockOrderResponse = {
    orderId: 'order-1',
    orderNumber: 'ZV-20260901-1234',
    status: OrderStatus.PENDING,
    paymentStatus: PaymentStatus.PENDING,
    paymentMethod: PaymentMethod.COD,
    subtotal: 2000,
    discountAmount: 0,
    shippingCost: 60,
    totalAmount: 2060,
    shippingZone: {
      id: 'zone-1',
      name: 'Inside Dhaka City',
      estimatedDeliveryDays: '1-2 Days',
      expressDeliveryDays: 'Same Day',
    },
    coupon: null,
    shippingAddress: {},
    billingAddress: {},
    items: [],
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const serviceMock = {
      trackOrder: jest
        .fn()
        .mockResolvedValue({ orderNumber: 'ZV-20260901-1234', steps: [] }),
      checkout: jest.fn().mockResolvedValue(mockOrderResponse),
      findMyOrders: jest.fn().mockResolvedValue({ orders: [], meta: {} }),
      findMyOrderById: jest.fn().mockResolvedValue(mockOrderResponse),
      cancelMyOrder: jest
        .fn()
        .mockResolvedValue({ status: OrderStatus.CANCELLED }),
      findAll: jest.fn().mockResolvedValue({ orders: [], meta: {} }),
      findOne: jest.fn().mockResolvedValue(mockOrderResponse),
      updateStatus: jest
        .fn()
        .mockResolvedValue({ status: OrderStatus.PROCESSING }),
      getMetricsSummary: jest
        .fn()
        .mockResolvedValue({ totalOrders: 10, totalRevenue: 50000 }),
      generateInvoice: jest
        .fn()
        .mockResolvedValue({ invoiceNumber: 'INV-123' }),
      generateInvoicePdf: jest.fn().mockResolvedValue({
        buffer: Buffer.from('%PDF-1.4 test invoice'),
        filename: 'invoice-ZV-1234.pdf',
      }),
      generateShippingLabelPdf: jest.fn().mockResolvedValue({
        buffer: Buffer.from('%PDF-1.4 test label'),
        filename: 'shipping-label-ZV-1234.pdf',
      }),
      generateBulkShippingLabelsPdf: jest.fn().mockResolvedValue({
        buffer: Buffer.from('%PDF-1.4 bulk labels'),
        filename: 'bulk-shipping-labels-12345.pdf',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    service = module.get(OrdersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('POST /orders/track should delegate to service.trackOrder', async () => {
    const dto = {
      orderNumber: 'ZV-20260901-1234',
      emailOrPhone: 'noman@example.com',
    };
    service.trackOrder.mockResolvedValue({
      orderNumber: 'ZV-20260901-1234',
      steps: [],
    } as unknown as Awaited<ReturnType<OrdersService['trackOrder']>>);

    const result = await controller.trackOrder(dto);
    expect(service.trackOrder).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ orderNumber: 'ZV-20260901-1234', steps: [] });
  });

  it('POST /orders/checkout should delegate to service.checkout', async () => {
    const dto = {
      paymentMethod: PaymentMethod.COD,
      shippingAddress: {
        fullName: 'Test User',
        phone: '01700000000',
        addressLine1: 'Test St',
        city: 'Dhaka',
        postalCode: '1212',
      },
    };

    const result = await controller.checkout('user-1', dto);
    expect(service.checkout).toHaveBeenCalledWith('user-1', dto);
    expect(result).toEqual(mockOrderResponse);
  });

  it('GET /orders/my-orders should delegate to service.findMyOrders', async () => {
    const query = { page: 1, limit: 10 };
    await controller.findMyOrders('user-1', query);
    expect(service.findMyOrders).toHaveBeenCalledWith('user-1', query);
  });

  it('GET /orders/metrics/summary should delegate to service.getMetricsSummary', async () => {
    await controller.getMetricsSummary();
    expect(service.getMetricsSummary).toHaveBeenCalled();
  });

  it('GET /orders/:id/invoice/pdf should stream PDF with appropriate headers', async () => {
    const mockRes = {
      set: jest.fn(),
      end: jest.fn(),
    } as unknown as Response;

    await controller.downloadInvoicePdf(
      'order-1',
      'user-1',
      'CUSTOMER',
      mockRes,
    );

    expect(service.generateInvoicePdf).toHaveBeenCalledWith(
      'order-1',
      'user-1',
      false,
    );
    expect(mockRes.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="invoice-ZV-1234.pdf"',
      }),
    );
    expect(mockRes.end).toHaveBeenCalled();
  });

  it('GET /orders/:id/shipping-label/pdf should stream 4x6" label PDF', async () => {
    const mockRes = {
      set: jest.fn(),
      end: jest.fn(),
    } as unknown as Response;

    await controller.downloadShippingLabelPdf('order-1', mockRes);

    expect(service.generateShippingLabelPdf).toHaveBeenCalledWith('order-1');
    expect(mockRes.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="shipping-label-ZV-1234.pdf"',
      }),
    );
    expect(mockRes.end).toHaveBeenCalled();
  });

  it('POST /orders/shipping-labels/bulk-pdf should stream multi-page bulk PDF', async () => {
    const mockRes = {
      set: jest.fn(),
      end: jest.fn(),
    } as unknown as Response;

    await controller.downloadBulkShippingLabelsPdf(
      { orderIds: ['order-1', 'order-2'] },
      mockRes,
    );

    expect(service.generateBulkShippingLabelsPdf).toHaveBeenCalledWith([
      'order-1',
      'order-2',
    ]);
    expect(mockRes.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Type': 'application/pdf',
      }),
    );
    expect(mockRes.end).toHaveBeenCalled();
  });
});
