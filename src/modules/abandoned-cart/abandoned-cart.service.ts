import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DiscountType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { MailService } from '../mail/mail.service.js';

type AbandonedCartWithItems = Prisma.CartGetPayload<{
  include: {
    user: { select: { id: true; name: true; email: true } };
    items: {
      include: {
        variant: {
          include: {
            product: {
              include: {
                images: { where: { isPrimary: true }; take: 1 };
              };
            };
          };
        };
      };
    };
  };
}>;

@Injectable()
export class AbandonedCartService {
  private readonly logger = new Logger(AbandonedCartService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Automated Background Cron: Runs every hour to scan abandoned shopping carts,
   * dynamically provisions a 10% recovery coupon, and delivers recovery emails.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleAbandonedCartCron() {
    this.logger.log(
      '⏰ Running automated abandoned cart recovery cron scan...',
    );
    return this.scanAndRecoverAbandonedCarts();
  }

  /**
   * Scans for carts abandoned between 2 and 48 hours ago and triggers recovery emails.
   */
  async scanAndRecoverAbandonedCarts() {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const abandonedCarts: AbandonedCartWithItems[] =
      await this.prisma.cart.findMany({
        where: {
          items: { some: {} }, // Has items in cart
          updatedAt: {
            lte: twoHoursAgo,
            gte: fortyEightHoursAgo,
          },
          OR: [
            { abandonedEmailSentAt: null },
            { abandonedEmailSentAt: { lte: sevenDaysAgo } },
          ],
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          items: {
            include: {
              variant: {
                include: {
                  product: {
                    include: {
                      images: { where: { isPrimary: true }, take: 1 },
                    },
                  },
                },
              },
            },
          },
        },
      });

    this.logger.log(
      `🔍 Found ${abandonedCarts.length} abandoned cart(s) eligible for recovery`,
    );

    let recoveredCount = 0;

    for (const cart of abandonedCarts) {
      if (!cart.user || !cart.user.email || cart.items.length === 0) continue;

      const customerName = cart.user.name || 'Valued Customer';
      const customerEmail = cart.user.email;

      // 1. Generate unique 10% dynamic recovery coupon (valid for 48 hours)
      const randomCodeSuffix = Math.random()
        .toString(36)
        .substring(2, 6)
        .toUpperCase();
      const recoveryCouponCode = `RECOVER-${randomCodeSuffix}`;
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

      await this.prisma.coupon.create({
        data: {
          code: recoveryCouponCode,
          description: `10% Abandoned Cart Recovery Discount for ${customerName}`,
          discountType: DiscountType.PERCENTAGE,
          discountValue: new Prisma.Decimal(10.0),
          startDate: new Date(),
          endDate: expiresAt,
          usageLimit: 1,
          perUserLimit: 1,
          isActive: true,
        },
      });

      // 2. Format items for email preview
      const previewItems: Array<{
        title: string;
        size: string;
        color: string;
        price: number;
        imageUrl: string | null;
      }> = cart.items.map((item) => {
        const variant = item.variant;
        const product = variant.product;
        const basePrice = product.discountPrice
          ? Number(product.discountPrice)
          : Number(product.basePrice);
        const extraPrice = Number(variant.extraPrice ?? 0);
        const price = basePrice + extraPrice;

        return {
          title: product.title,
          size: variant.size,
          color: variant.color,
          price,
          imageUrl: variant.imageUrl || product.images[0]?.url || null,
        };
      });

      // 3. Dispatch recovery email
      const emailSent = await this.mailService.sendAbandonedCartEmail(
        customerEmail,
        {
          customerName,
          items: previewItems,
          recoveryCouponCode,
          discountPercent: 10,
          cartUrl: 'https://zevon.com/cart',
        },
      );

      if (emailSent) {
        await this.prisma.cart.update({
          where: { id: cart.id },
          data: {
            abandonedEmailSentAt: new Date(),
            abandonedEmailCount: { increment: 1 },
          },
        });
        recoveredCount++;
      }
    }

    this.logger.log(
      `✅ Abandoned cart recovery complete. Dispatched ${recoveredCount}/${abandonedCarts.length} emails.`,
    );

    return {
      scannedCartsCount: abandonedCarts.length,
      dispatchedRecoveryEmails: recoveredCount,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Admin: List currently abandoned carts.
   */
  async getAbandonedCartsList() {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const carts = await this.prisma.cart.findMany({
      where: {
        items: { some: {} },
        updatedAt: { lte: twoHoursAgo },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        items: {
          include: {
            variant: {
              include: {
                product: { select: { title: true, basePrice: true } },
              },
            },
          },
        },
      },
    });

    return {
      totalAbandoned: carts.length,
      carts: carts.map((c) => ({
        id: c.id,
        user: c.user,
        itemsCount: c.items.length,
        abandonedEmailSentAt: c.abandonedEmailSentAt,
        abandonedEmailCount: c.abandonedEmailCount,
        lastActiveAt: c.updatedAt,
      })),
    };
  }
}
