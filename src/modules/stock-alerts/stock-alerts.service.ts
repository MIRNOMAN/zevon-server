import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma, StockAlertStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { SubscribeStockAlertDto, StockAlertQueryDto } from './dto/index.js';

@Injectable()
export class StockAlertsService {
  private readonly logger = new Logger(StockAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  // ── Customer / Guest: Subscribe to Back-in-Stock Alert ─────────────────

  /**
   * Subscribes user email/phone for back-in-stock notification when a specific
   * product variant (size/color) is currently out-of-stock.
   */
  async subscribe(dto: SubscribeStockAlertDto, userId?: string) {
    const { productVariantId, email, phone } = dto;
    const cleanEmail = email.trim().toLowerCase();

    // 1. Verify Product Variant exists
    let variant = await this.prisma.productVariant.findUnique({
      where: { id: productVariantId },
      include: {
        product: { select: { id: true, title: true, isPublished: true } },
      },
    });

    if (!variant) {
      variant = await this.prisma.productVariant.findUnique({
        where: { sku: productVariantId },
        include: {
          product: { select: { id: true, title: true, isPublished: true } },
        },
      });
    }

    if (!variant) {
      variant = await this.prisma.productVariant.findFirst({
        where: { productId: productVariantId },
        include: {
          product: { select: { id: true, title: true, isPublished: true } },
        },
      });
    }

    if (!variant || !variant.product.isPublished) {
      throw new NotFoundException(
        'The requested product variant was not found',
      );
    }

    const actualVariantId = variant.id;

    // 2. If item is currently in stock (> 0), inform customer
    if (variant.stock > 0) {
      return {
        isAlreadyInStock: true,
        message: `This item (${variant.size}, ${variant.color}) is currently in stock with ${variant.stock} units available!`,
        variantId: variant.id,
        currentStock: variant.stock,
      };
    }

    // 3. Prevent duplicate active subscriptions
    const existingSubscription = await this.prisma.stockAlert.findFirst({
      where: {
        productVariantId: actualVariantId,
        email: cleanEmail,
        status: StockAlertStatus.PENDING,
      },
    });

    if (existingSubscription) {
      return {
        isAlreadyInStock: false,
        message: `You are already subscribed to back-in-stock alerts for this item (${variant.size}, ${variant.color}). We will notify ${cleanEmail} as soon as it arrives!`,
        subscriptionId: existingSubscription.id,
        status: existingSubscription.status,
      };
    }

    // 4. Create new StockAlert record
    const alert = await this.prisma.stockAlert.create({
      data: {
        productVariantId: actualVariantId,
        userId: userId || null,
        email: cleanEmail,
        phone: phone ? phone.trim() : null,
        status: StockAlertStatus.PENDING,
      },
      include: {
        productVariant: {
          include: {
            product: { select: { title: true, slug: true } },
          },
        },
      },
    });

    this.logger.log(
      `🔔 New back-in-stock alert registered: ${cleanEmail} for ${alert.productVariant.product.title} (${alert.productVariant.sku})`,
    );

    return {
      isAlreadyInStock: false,
      message: `You have successfully subscribed to back-in-stock notifications. We will email ${cleanEmail} immediately when restocked!`,
      subscriptionId: alert.id,
      productTitle: alert.productVariant.product.title,
      size: alert.productVariant.size,
      color: alert.productVariant.color,
      sku: alert.productVariant.sku,
      status: alert.status,
      createdAt: alert.createdAt,
    };
  }

  // ── Automated Restock Trigger Engine ───────────────────────────────────

  /**
   * Triggered when inventory for a variant is restocked (stock > 0).
   * Finds all PENDING subscriptions and dispatches automated back-in-stock emails.
   */
  async notifySubscribers(productVariantId: string, newStock: number) {
    if (newStock <= 0) return { notifiedCount: 0 };

    const pendingAlerts = await this.prisma.stockAlert.findMany({
      where: {
        productVariantId,
        status: StockAlertStatus.PENDING,
      },
      include: {
        user: { select: { name: true } },
        productVariant: {
          include: {
            product: {
              include: {
                images: { where: { isPrimary: true }, take: 1 },
              },
            },
          },
        },
      },
    });

    if (pendingAlerts.length === 0) {
      return { notifiedCount: 0 };
    }

    this.logger.log(
      `🚀 Restock trigger: dispatching ${pendingAlerts.length} back-in-stock alerts for variant ${productVariantId}`,
    );

    let notifiedCount = 0;

    for (const alert of pendingAlerts) {
      const { productVariant } = alert;
      const { product } = productVariant;
      const unitPrice =
        Number(product.discountPrice ?? product.basePrice) +
        Number(productVariant.extraPrice);

      const emailSent = await this.mailService.sendBackInStockEmail({
        customerEmail: alert.email,
        customerName: alert.user?.name,
        productTitle: product.title,
        productSlug: product.slug,
        sku: productVariant.sku,
        size: productVariant.size,
        color: productVariant.color,
        unitPrice,
        imageUrl: productVariant.imageUrl || product.images[0]?.url || null,
      });

      if (emailSent) {
        await this.prisma.stockAlert.update({
          where: { id: alert.id },
          data: {
            status: StockAlertStatus.NOTIFIED,
            notifiedAt: new Date(),
          },
        });
        notifiedCount++;
      }
    }

    this.logger.log(
      `✅ Successfully notified ${notifiedCount}/${pendingAlerts.length} subscribers for variant ${productVariantId}`,
    );

    return {
      notifiedCount,
      totalPending: pendingAlerts.length,
    };
  }

  // ── Customer: Get My Subscriptions ─────────────────────────────────────

  /**
   * Customer: Get list of active and past stock alert subscriptions.
   */
  async findMyAlerts(userId: string) {
    return this.prisma.stockAlert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        productVariant: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                slug: true,
                basePrice: true,
                discountPrice: true,
                images: { where: { isPrimary: true }, take: 1 },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Customer / Guest: Cancel a stock alert subscription.
   */
  async cancelAlert(
    id: string,
    userOrEmail?: { userId?: string; email?: string },
  ) {
    const alert = await this.prisma.stockAlert.findUnique({
      where: { id },
    });

    if (!alert) {
      throw new NotFoundException(`Stock alert with ID "${id}" was not found`);
    }

    if (
      userOrEmail?.userId &&
      alert.userId &&
      alert.userId !== userOrEmail.userId
    ) {
      throw new BadRequestException(
        'You do not have permission to cancel this alert',
      );
    }

    return this.prisma.stockAlert.update({
      where: { id },
      data: { status: StockAlertStatus.CANCELLED },
    });
  }

  // ── Admin: List All Stock Alerts ────────────────────────────────────────

  /**
   * Admin: List stock alerts with filters and search.
   */
  async findAll(query: StockAlertQueryDto) {
    const { page = 1, limit = 20, status, variantId, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.StockAlertWhereInput = {
      ...(status ? { status } : {}),
      ...(variantId ? { productVariantId: variantId } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              {
                productVariant: {
                  sku: { contains: search, mode: 'insensitive' },
                },
              },
              {
                productVariant: {
                  product: {
                    title: { contains: search, mode: 'insensitive' },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [total, alerts] = await Promise.all([
      this.prisma.stockAlert.count({ where }),
      this.prisma.stockAlert.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          productVariant: {
            include: {
              product: { select: { id: true, title: true, slug: true } },
            },
          },
        },
      }),
    ]);

    return {
      alerts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
