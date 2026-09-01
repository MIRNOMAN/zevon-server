/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let service: jest.Mocked<AnalyticsService>;

  beforeEach(async () => {
    const serviceMock = {
      getDashboardMetrics: jest.fn().mockResolvedValue({
        kpis: { totalRevenue: 50000, totalOrders: 25 },
        dailySalesChart: [],
      }),
      getInventoryAlerts: jest.fn().mockResolvedValue({
        summary: { totalAlerts: 2 },
        alerts: [],
      }),
      getInventoryKanban: jest.fn().mockResolvedValue({
        metrics: { totalUnitsInWarehouse: 200 },
        columns: {},
      }),
      getSalesReport: jest.fn().mockResolvedValue({
        summary: { totalOrders: 10 },
        recentOrders: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [{ provide: AnalyticsService, useValue: serviceMock }],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    service = module.get(AnalyticsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /analytics/dashboard should delegate to service.getDashboardMetrics', async () => {
    const res = await controller.getDashboardMetrics();
    expect(service.getDashboardMetrics).toHaveBeenCalled();
    expect(res.kpis.totalRevenue).toBe(50000);
  });

  it('GET /analytics/inventory-alerts should delegate with default threshold 5', async () => {
    const res = await controller.getInventoryAlerts();
    expect(service.getInventoryAlerts).toHaveBeenCalledWith(5);
    expect(res.summary.totalAlerts).toBe(2);
  });
});
