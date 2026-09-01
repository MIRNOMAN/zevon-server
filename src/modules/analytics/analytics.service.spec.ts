import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { OrderStatus, PaymentStatus, Role } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const prismaMock = {
      order: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: {
            totalAmount: new Decimal(50000),
            subtotal: new Decimal(48000),
            discountAmount: new Decimal(2000),
            shippingCost: new Decimal(4000),
          },
          _count: { id: 25 },
          _avg: { totalAmount: new Decimal(2000) },
        }),
        count: jest.fn().mockResolvedValue(25),
        groupBy: jest.fn().mockResolvedValue([
          { status: OrderStatus.DELIVERED, _count: { id: 15 } },
          { status: OrderStatus.SHIPPED, _count: { id: 5 } },
          { status: OrderStatus.PENDING, _count: { id: 5 } },
        ]),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'order-1',
            orderNumber: 'ZV-20260901-0001',
            totalAmount: new Decimal(2000),
            paymentStatus: PaymentStatus.PAID,
            createdAt: new Date(),
          },
        ]),
      },
      user: {
        count: jest.fn().mockResolvedValue(100),
      },
      cart: {
        count: jest.fn().mockResolvedValue(10),
      },
      returnRequest: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
      productVariant: {
        count: jest.fn().mockResolvedValue(3),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'var-1',
            sku: 'ZEV-TEE-BLK-M',
            color: 'Black',
            colorCode: '#000000',
            size: 'M',
            stock: 2, // CRITICAL alert
            extraPrice: new Decimal(0),
            imageUrl: null,
            product: {
              id: 'prod-1',
              title: 'Oversized Tee',
              slug: 'oversized-tee',
              basePrice: new Decimal(1200),
              discountPrice: null,
              isPublished: true,
              category: { id: 'cat-1', name: 'T-Shirts' },
              images: [{ url: 'https://cdn.zevon.com/tee.jpg' }],
            },
          },
          {
            id: 'var-2',
            sku: 'ZEV-TEE-WHT-L',
            color: 'White',
            colorCode: '#ffffff',
            size: 'L',
            stock: 0, // OUT OF STOCK
            extraPrice: new Decimal(0),
            imageUrl: null,
            product: {
              id: 'prod-1',
              title: 'Oversized Tee',
              slug: 'oversized-tee',
              basePrice: new Decimal(1200),
              discountPrice: null,
              isPublished: true,
              category: { id: 'cat-1', name: 'T-Shirts' },
              images: [],
            },
          },
        ]),
      },
      orderItem: {
        groupBy: jest.fn().mockResolvedValue([
          {
            productId: 'prod-1',
            productTitle: 'Oversized Tee',
            _sum: { quantity: 45, totalPrice: new Decimal(54000) },
          },
        ]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboardMetrics', () => {
    it('should aggregate KPIs and generate 30-day daily sales chart without gaps', async () => {
      const dashboard = await service.getDashboardMetrics();

      expect(dashboard.kpis.totalRevenue).toBe(50000);
      expect(dashboard.kpis.totalOrders).toBe(25);
      expect(dashboard.kpis.totalCustomers).toBe(100);
      expect(dashboard.kpis.averageOrderValue).toBe(2000);
      expect(dashboard.dailySalesChart).toHaveLength(30);
      expect(dashboard.ordersByStatus.DELIVERED).toBe(15);
      expect(dashboard.topSellingProducts).toHaveLength(1);
      expect(dashboard.topSellingProducts[0].productTitle).toBe(
        'Oversized Tee',
      );
    });
  });

  describe('getInventoryAlerts', () => {
    it('should categorize variants by severity (OUT_OF_STOCK, CRITICAL, LOW_STOCK)', async () => {
      const alerts = await service.getInventoryAlerts(5);

      expect(alerts.summary.totalAlerts).toBe(2);
      expect(alerts.summary.outOfStockCount).toBe(1);
      expect(alerts.summary.criticalCount).toBe(1);
      expect(alerts.alerts[0].severity).toBe('CRITICAL');
      expect(alerts.alerts[1].severity).toBe('OUT_OF_STOCK');
    });
  });

  describe('getInventoryKanban', () => {
    it('should group inventory into Kanban columns with valuation calculation', async () => {
      const kanban = await service.getInventoryKanban();

      expect(kanban.columns.OUT_OF_STOCK.count).toBe(1);
      expect(kanban.columns.LOW_STOCK.count).toBe(1);
      expect(kanban.metrics.totalUnitsInWarehouse).toBe(2);
      expect(kanban.metrics.totalWarehouseValuation).toBe(2400); // 2 units * 1200
    });
  });
});
