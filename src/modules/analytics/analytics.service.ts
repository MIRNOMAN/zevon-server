import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  OrderStatus,
  PaymentStatus,
  Role,
  ReturnStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { SalesReportQueryDto } from './dto/index.js';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── 1. Admin KPI & Chart Dashboard Analytics ───────────────────────────

  /**
   * Admin Control Center: Comprehensive KPI dashboard, 30-day daily sales
   * time-series aggregation, conversion metrics, and status breakdowns.
   */
  async getDashboardMetrics() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    // Parallel aggregate queries for speed and efficiency
    const [
      paidRevenueAggregate,
      totalOrdersCount,
      totalCustomersCount,
      activeCartsCount,
      ordersByStatusRaw,
      returnsCountRaw,
      lowStockVariantsCount,
      recentOrders30Days,
      topSellingItemsRaw,
    ] = await Promise.all([
      // Total Revenue from PAID orders
      this.prisma.order.aggregate({
        where: { paymentStatus: PaymentStatus.PAID },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),

      // Total Non-cancelled Orders
      this.prisma.order.count({
        where: { status: { not: OrderStatus.CANCELLED } },
      }),

      // Total Registered Customers
      this.prisma.user.count({
        where: { role: Role.CUSTOMER },
      }),

      // Active shopping carts
      this.prisma.cart.count({
        where: { items: { some: {} } },
      }),

      // Order counts grouped by status
      this.prisma.order.groupBy({
        by: ['status'],
        _count: { id: true },
      }),

      // Return requests count by status
      this.prisma.returnRequest.groupBy({
        by: ['status'],
        _count: { id: true },
      }),

      // Low stock count (stock <= 5)
      this.prisma.productVariant.count({
        where: { stock: { lte: 5 } },
      }),

      // Orders in the last 30 days for daily sales time-series chart
      this.prisma.order.findMany({
        where: {
          createdAt: { gte: thirtyDaysAgo },
          status: { not: OrderStatus.CANCELLED },
        },
        select: {
          id: true,
          totalAmount: true,
          paymentStatus: true,
          createdAt: true,
        },
      }),

      // Top selling products by quantity
      this.prisma.orderItem.groupBy({
        by: ['productId', 'productTitle'],
        _sum: { quantity: true, totalPrice: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
    ]);

    const totalRevenue = Number(paidRevenueAggregate._sum.totalAmount || 0);
    const paidOrdersCount = paidRevenueAggregate._count.id;
    const averageOrderValue =
      paidOrdersCount > 0
        ? Number((totalRevenue / paidOrdersCount).toFixed(2))
        : 0;

    // Conversion rate: Converted orders vs (Total orders + Abandoned/Active Carts)
    const totalPotentialCheckouts = totalOrdersCount + activeCartsCount;
    const conversionRate =
      totalPotentialCheckouts > 0
        ? Number(
            ((totalOrdersCount / totalPotentialCheckouts) * 100).toFixed(2),
          )
        : 0;

    // ── 30-Day Daily Sales Revenue Time-Series Chart Aggregation ───────────
    const dailyMap = new Map<
      string,
      {
        date: string;
        revenue: number;
        orderCount: number;
        paidOrdersCount: number;
      }
    >();

    // Pre-populate all 30 days so there are no gaps in the chart
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      dailyMap.set(dateStr, {
        date: dateStr,
        revenue: 0,
        orderCount: 0,
        paidOrdersCount: 0,
      });
    }

    // Accumulate orders into day buckets
    for (const order of recentOrders30Days) {
      const dateStr = new Date(order.createdAt).toISOString().slice(0, 10);
      const entry = dailyMap.get(dateStr);
      if (entry) {
        entry.orderCount += 1;
        if (order.paymentStatus === PaymentStatus.PAID) {
          entry.revenue = Number(
            (entry.revenue + Number(order.totalAmount)).toFixed(2),
          );
          entry.paidOrdersCount += 1;
        }
      }
    }

    const dailySalesChart = Array.from(dailyMap.values());

    // ── Order Status Breakdown Matrix ─────────────────────────────────────
    const ordersByStatus: Record<string, number> = {
      PENDING: 0,
      CONFIRMED: 0,
      PROCESSING: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      CANCELLED: 0,
      RETURNED: 0,
    };
    for (const row of ordersByStatusRaw) {
      ordersByStatus[row.status] = row._count.id;
    }

    // ── Returns Breakdown Matrix ──────────────────────────────────────────
    const returnsByStatus: Record<string, number> = {
      REQUESTED: 0,
      APPROVED: 0,
      REJECTED: 0,
      RECEIVED: 0,
      REFUNDED: 0,
    };
    let totalReturns = 0;
    for (const row of returnsCountRaw) {
      returnsByStatus[row.status] = row._count.id;
      totalReturns += row._count.id;
    }

    // ── Top Selling Products List ─────────────────────────────────────────
    const topSellingProducts = topSellingItemsRaw.map((item) => ({
      productId: item.productId,
      productTitle: item.productTitle,
      totalUnitsSold: item._sum.quantity || 0,
      totalRevenue: Number((item._sum.totalPrice || 0).toString()),
    }));

    return {
      kpis: {
        totalRevenue,
        totalOrders: totalOrdersCount,
        totalCustomers: totalCustomersCount,
        averageOrderValue,
        conversionRate,
        currency: 'BDT (৳)',
      },
      dailySalesChart,
      ordersByStatus,
      returnsSummary: {
        totalReturns,
        byStatus: returnsByStatus,
      },
      inventoryAlertsCount: lowStockVariantsCount,
      topSellingProducts,
    };
  }

  // ── 2. Low-Stock Inventory Alerts (stock <= 5) ──────────────────────────

  /**
   * Admin: List all clothing variants with low stock (<= threshold, default 5).
   * Categorized by severity: OUT_OF_STOCK (0), CRITICAL (1-2), LOW_STOCK (3-5).
   */
  async getInventoryAlerts(threshold = 5) {
    const variants = await this.prisma.productVariant.findMany({
      where: {
        stock: { lte: threshold },
      },
      orderBy: [{ stock: 'asc' }, { updatedAt: 'desc' }],
      include: {
        product: {
          select: {
            id: true,
            title: true,
            slug: true,
            basePrice: true,
            discountPrice: true,
            isPublished: true,
            category: { select: { id: true, name: true } },
            images: {
              where: { isPrimary: true },
              take: 1,
              select: { url: true },
            },
          },
        },
      },
    });

    let outOfStockCount = 0;
    let criticalCount = 0;
    let lowStockCount = 0;

    const formattedAlerts = variants.map((v) => {
      let severity: 'OUT_OF_STOCK' | 'CRITICAL' | 'LOW_STOCK';
      if (v.stock === 0) {
        severity = 'OUT_OF_STOCK';
        outOfStockCount++;
      } else if (v.stock <= 2) {
        severity = 'CRITICAL';
        criticalCount++;
      } else {
        severity = 'LOW_STOCK';
        lowStockCount++;
      }

      const unitPrice =
        Number(v.product.discountPrice ?? v.product.basePrice) +
        Number(v.extraPrice);

      return {
        variantId: v.id,
        sku: v.sku,
        color: v.color,
        colorCode: v.colorCode,
        size: v.size,
        stock: v.stock,
        severity,
        unitPrice,
        imageUrl: v.imageUrl || v.product.images[0]?.url || null,
        product: {
          id: v.product.id,
          title: v.product.title,
          slug: v.product.slug,
          isPublished: v.product.isPublished,
          categoryName: v.product.category?.name || 'General',
        },
      };
    });

    return {
      summary: {
        totalAlerts: variants.length,
        outOfStockCount,
        criticalCount,
        lowStockCount,
        threshold,
      },
      alerts: formattedAlerts,
    };
  }

  // ── 3. Inventory Kanban Board & Warehouse Valuation ─────────────────────

  /**
   * Admin: Group store inventory into Kanban columns with total valuation.
   * Columns: OUT_OF_STOCK (0), LOW_STOCK (1-5), IN_STOCK (> 5).
   */
  async getInventoryKanban() {
    const allVariants = await this.prisma.productVariant.findMany({
      orderBy: [{ stock: 'asc' }, { updatedAt: 'desc' }],
      include: {
        product: {
          select: {
            id: true,
            title: true,
            slug: true,
            basePrice: true,
            discountPrice: true,
            category: { select: { name: true } },
            images: {
              where: { isPrimary: true },
              take: 1,
              select: { url: true },
            },
          },
        },
      },
    });

    const outOfStock: Array<Record<string, unknown>> = [];
    const lowStock: Array<Record<string, unknown>> = [];
    const inStock: Array<Record<string, unknown>> = [];

    let totalUnits = 0;
    let totalValuation = 0;

    for (const v of allVariants) {
      const unitPrice =
        Number(v.product.discountPrice ?? v.product.basePrice) +
        Number(v.extraPrice);
      const stockValuation = unitPrice * v.stock;

      totalUnits += v.stock;
      totalValuation += stockValuation;

      const card = {
        variantId: v.id,
        sku: v.sku,
        color: v.color,
        colorCode: v.colorCode,
        size: v.size,
        stock: v.stock,
        unitPrice,
        stockValuation,
        imageUrl: v.imageUrl || v.product.images[0]?.url || null,
        productTitle: v.product.title,
        categoryName: v.product.category?.name || 'General',
      };

      if (v.stock === 0) {
        outOfStock.push(card);
      } else if (v.stock <= 5) {
        lowStock.push(card);
      } else {
        inStock.push(card);
      }
    }

    return {
      metrics: {
        totalVariantsCount: allVariants.length,
        totalUnitsInWarehouse: totalUnits,
        totalWarehouseValuation: Number(totalValuation.toFixed(2)),
        currency: 'BDT (৳)',
      },
      columns: {
        OUT_OF_STOCK: {
          title: 'Out of Stock (0 units)',
          count: outOfStock.length,
          items: outOfStock,
        },
        LOW_STOCK: {
          title: 'Low Stock (1-5 units)',
          count: lowStock.length,
          items: lowStock,
        },
        IN_STOCK: {
          title: 'In Stock (> 5 units)',
          count: inStock.length,
          items: inStock,
        },
      },
    };
  }

  // ── 4. Custom Sales Report & Analytics ──────────────────────────────────

  /**
   * Admin: Generate custom date-range sales and revenue report.
   */
  async getSalesReport(query: SalesReportQueryDto) {
    const { startDate, endDate, paymentStatus } = query;

    const where: Prisma.OrderWhereInput = {
      status: { not: OrderStatus.CANCELLED },
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
    };

    const [aggregate, ordersCount, orders] = await Promise.all([
      this.prisma.order.aggregate({
        where,
        _sum: {
          subtotal: true,
          discountAmount: true,
          shippingCost: true,
          totalAmount: true,
        },
        _avg: {
          totalAmount: true,
        },
      }),
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
          _count: { select: { items: true } },
        },
      }),
    ]);

    const totalRevenue = Number(aggregate._sum.totalAmount || 0);
    const grossSubtotal = Number(aggregate._sum.subtotal || 0);
    const totalDiscounts = Number(aggregate._sum.discountAmount || 0);
    const totalShipping = Number(aggregate._sum.shippingCost || 0);
    const averageOrderValue = Number(
      (aggregate._avg.totalAmount || 0).toFixed(2),
    );

    return {
      summary: {
        totalOrders: ordersCount,
        grossSubtotal,
        totalDiscounts,
        totalShipping,
        netRevenue: totalRevenue,
        averageOrderValue,
        currency: 'BDT (৳)',
      },
      recentOrders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.user?.name || 'Customer',
        totalAmount: Number(o.totalAmount),
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        status: o.status,
        itemCount: o._count.items,
        createdAt: o.createdAt,
      })),
    };
  }
}
