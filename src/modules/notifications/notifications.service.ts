import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'ORDER' | 'STOCK' | 'RETURN' | 'REVIEW' | 'SYSTEM';
  link: string;
  isRead: boolean;
  createdAt: string;
}

@Injectable()
export class NotificationsService {
  private readNotificationIds = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all live notifications gathered dynamically from database
   */
  async findAll(): Promise<NotificationItem[]> {
    const notifications: NotificationItem[] = [];

    // 1. Recent orders
    try {
      const recentOrders = await this.prisma.order.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          status: true,
          createdAt: true,
        },
      });

      recentOrders.forEach((o) => {
        const id = `order-${o.id}`;
        notifications.push({
          id,
          title: `New Order #${o.orderNumber || o.id.slice(-6).toUpperCase()}`,
          message: `Total value: $${Number(o.totalAmount).toFixed(2)} — Status: ${o.status}`,
          type: 'ORDER',
          link: `/dashboard/orders`,
          isRead: this.readNotificationIds.has(id),
          createdAt: o.createdAt.toISOString(),
        });
      });
    } catch {}

    // 2. Low stock variants (< 5 inventory units)
    try {
      const lowStockVariants = await this.prisma.productVariant.findMany({
        where: { stock: { lte: 5 } },
        take: 6,
        include: {
          product: { select: { title: true, id: true } },
        },
        orderBy: { stock: 'asc' },
      });

      lowStockVariants.forEach((v) => {
        const id = `stock-${v.id}`;
        notifications.push({
          id,
          title: `Low Stock Alert: ${v.product?.title || 'Garment Item'}`,
          message: `Only ${v.stock} unit(s) remaining for SKU ${v.sku}`,
          type: 'STOCK',
          link: `/dashboard/stock-alerts`,
          isRead: this.readNotificationIds.has(id),
          createdAt: v.updatedAt.toISOString(),
        });
      });
    } catch {}

    // 3. Return Requests
    try {
      const recentReturns = await this.prisma.returnRequest.findMany({
        where: { status: 'REQUESTED' },
        take: 5,
        orderBy: { createdAt: 'desc' },
      });

      recentReturns.forEach((r) => {
        const id = `return-${r.id}`;
        notifications.push({
          id,
          title: `Return Request Pending`,
          message: `Reason: ${r.reason || 'Customer requested return'}`,
          type: 'RETURN',
          link: `/dashboard/returns`,
          isRead: this.readNotificationIds.has(id),
          createdAt: r.createdAt.toISOString(),
        });
      });
    } catch {}

    // Sort newest first
    notifications.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return notifications;
  }

  /**
   * Get unread notifications count
   */
  async getUnreadCount(): Promise<{ unreadCount: number }> {
    const list = await this.findAll();
    const unreadCount = list.filter((n) => !n.isRead).length;
    return { unreadCount };
  }

  /**
   * Mark single or all notifications as read
   */
  async markAsRead(dto: { id?: string; all?: boolean }) {
    if (dto.all) {
      const all = await this.findAll();
      all.forEach((n) => this.readNotificationIds.add(n.id));
    } else if (dto.id) {
      this.readNotificationIds.add(dto.id);
    }
    return { success: true, message: 'Notifications marked as read' };
  }
}
