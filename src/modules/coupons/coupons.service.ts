import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, OrderStatus, DiscountType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import {
  ValidateCouponDto,
  CreateCouponDto,
  UpdateCouponDto,
} from './dto/index.js';

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Customer / Checkout: Dynamic Coupon Validation Engine.
   * Validates:
   * 1. Active & Valid Code
   * 2. Promotion Start & Expiration Date
   * 3. Overall Campaign Usage Limit
   * 4. Per-User Usage Limit (Previous orders check)
   * 5. Minimum Cart Spend Threshold
   * 6. Percentage Cap / Flat Discount Calculations
   */
  async validateCoupon(userId: string, validateCouponDto: ValidateCouponDto) {
    const { code, cartSubtotal } = validateCouponDto;
    const cleanCode = code.trim().toUpperCase();
    const now = new Date();

    // 1. Check Coupon Existence
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: cleanCode },
    });

    if (!coupon) {
      throw new NotFoundException(`Coupon code "${cleanCode}" is invalid`);
    }

    // 2. Check Active Status
    if (!coupon.isActive) {
      throw new BadRequestException(
        `Coupon "${cleanCode}" is currently inactive`,
      );
    }

    // 3. Check Promotion Date Range
    if (now < coupon.startDate) {
      throw new BadRequestException(
        `Coupon promotion starts on ${coupon.startDate.toLocaleDateString()}`,
      );
    }

    if (now > coupon.endDate) {
      throw new BadRequestException(
        `Coupon "${cleanCode}" expired on ${coupon.endDate.toLocaleDateString()}`,
      );
    }

    // 4. Check Global Campaign Usage Limit
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException(
        'This coupon promotion has reached its maximum redemption limit',
      );
    }

    // 5. Check Per-User Redemption Limit
    const userUsedCount = await this.prisma.order.count({
      where: {
        userId,
        couponId: coupon.id,
        status: { notIn: [OrderStatus.CANCELLED] },
      },
    });

    const perUserLimit = coupon.perUserLimit ?? 1;
    if (userUsedCount >= perUserLimit) {
      throw new BadRequestException(
        `You have already redeemed this coupon the maximum allowed times (${perUserLimit}x)`,
      );
    }

    // 6. Determine Cart Subtotal (from input or active DB cart)
    let currentSubtotal = cartSubtotal;

    if (currentSubtotal === undefined || currentSubtotal === null) {
      const userCart = await this.prisma.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: {
              variant: {
                include: { product: true },
              },
            },
          },
        },
      });

      if (!userCart || userCart.items.length === 0) {
        throw new BadRequestException(
          'Your shopping cart is empty. Add products to apply a coupon.',
        );
      }

      currentSubtotal = userCart.items.reduce((acc, item) => {
        const base = Number(
          item.variant.product.discountPrice ?? item.variant.product.basePrice,
        );
        const extra = Number(item.variant.extraPrice);
        return acc + (base + extra) * item.quantity;
      }, 0);
    }

    if (currentSubtotal <= 0) {
      throw new BadRequestException(
        'Shopping cart subtotal must be greater than 0',
      );
    }

    // 7. Check Minimum Spend Requirement
    const minOrder = coupon.minOrderAmount ? Number(coupon.minOrderAmount) : 0;
    if (minOrder > 0 && currentSubtotal < minOrder) {
      throw new BadRequestException(
        `Minimum order spend of ৳${minOrder} required to apply coupon "${cleanCode}". Current subtotal: ৳${currentSubtotal.toFixed(2)}`,
      );
    }

    // 8. Calculate Discount & Savings Amount
    let discountAmount = 0;
    const discountVal = Number(coupon.discountValue);

    if (coupon.discountType === DiscountType.PERCENTAGE) {
      const rawDiscount = (currentSubtotal * discountVal) / 100;
      if (coupon.maxDiscountAmount !== null) {
        const maxCap = Number(coupon.maxDiscountAmount);
        discountAmount = Math.min(rawDiscount, maxCap);
      } else {
        discountAmount = rawDiscount;
      }
    } else {
      // FIXED_AMOUNT discount
      discountAmount = Math.min(discountVal, currentSubtotal);
    }

    discountAmount = Number(discountAmount.toFixed(2));
    const finalTotal = Number(
      Math.max(0, currentSubtotal - discountAmount).toFixed(2),
    );

    const savingsMessage =
      coupon.discountType === DiscountType.PERCENTAGE
        ? `You saved ৳${discountAmount} (${discountVal}% off${
            coupon.maxDiscountAmount
              ? ` up to ৳${Number(coupon.maxDiscountAmount)}`
              : ''
          })!`
        : `You saved ৳${discountAmount} flat discount!`;

    return {
      valid: true,
      couponId: coupon.id,
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: discountVal,
      cartSubtotal: Number(currentSubtotal.toFixed(2)),
      discountAmount,
      finalTotal,
      savingsMessage,
    };
  }

  // ── Admin Coupon Management ──────────────────────────────────

  /**
   * Admin: Create a new promotional coupon.
   */
  async create(createCouponDto: CreateCouponDto) {
    const { code, startDate, endDate, ...rest } = createCouponDto;
    const cleanCode = code.trim().toUpperCase();

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      throw new BadRequestException('startDate must be before endDate');
    }

    const existing = await this.prisma.coupon.findUnique({
      where: { code: cleanCode },
    });

    if (existing) {
      throw new ConflictException(
        `Coupon with code "${cleanCode}" already exists`,
      );
    }

    return this.prisma.coupon.create({
      data: {
        ...rest,
        code: cleanCode,
        startDate: start,
        endDate: end,
      },
    });
  }

  /**
   * Admin: List all coupons with filters and usage metrics.
   */
  async findAll(page = 1, limit = 20, isActive?: boolean, search?: string) {
    const skip = (page - 1) * limit;

    const where: Prisma.CouponWhereInput = {
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, coupons] = await Promise.all([
      this.prisma.coupon.count({ where }),
      this.prisma.coupon.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { orders: true },
          },
        },
      }),
    ]);

    const now = new Date();
    const formatted = coupons.map((c) => {
      const isExpired = now > c.endDate;
      const isNotStarted = now < c.startDate;
      let status = 'ACTIVE';
      if (!c.isActive) status = 'INACTIVE';
      else if (isExpired) status = 'EXPIRED';
      else if (isNotStarted) status = 'SCHEDULED';

      return {
        ...c,
        status,
        redeemedOrdersCount: c._count.orders,
      };
    });

    return {
      coupons: formatted,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin: Get coupon details by ID.
   */
  async findOne(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: {
        _count: {
          select: { orders: true },
        },
      },
    });

    if (!coupon) {
      throw new NotFoundException(`Coupon with ID "${id}" not found`);
    }

    return coupon;
  }

  /**
   * Admin: Update coupon details.
   */
  async update(id: string, updateCouponDto: UpdateCouponDto) {
    await this.findOne(id);

    const { code, startDate, endDate, ...rest } = updateCouponDto;

    const dataToUpdate: Prisma.CouponUpdateInput = {
      ...rest,
      ...(code ? { code: code.trim().toUpperCase() } : {}),
      ...(startDate ? { startDate: new Date(startDate) } : {}),
      ...(endDate ? { endDate: new Date(endDate) } : {}),
    };

    if (code) {
      const cleanCode = code.trim().toUpperCase();
      const existing = await this.prisma.coupon.findUnique({
        where: { code: cleanCode },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Coupon code "${cleanCode}" is already in use by another coupon`,
        );
      }
    }

    return this.prisma.coupon.update({
      where: { id },
      data: dataToUpdate,
    });
  }

  /**
   * Admin: Toggle coupon active status.
   */
  async toggleStatus(id: string) {
    const coupon = await this.findOne(id);

    return this.prisma.coupon.update({
      where: { id },
      data: {
        isActive: !coupon.isActive,
      },
    });
  }

  /**
   * Admin: Delete coupon.
   */
  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.coupon.delete({
      where: { id },
    });
  }
}
