import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  Prisma,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { ShippingService } from '../shipping/shipping.service.js';
import { CouponsService } from '../coupons/coupons.service.js';
import {
  CheckoutDto,
  UpdateOrderStatusDto,
  UpdatePaymentStatusDto,
  OrderQueryDto,
  AddressSnapshotDto,
} from './dto/index.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shippingService: ShippingService,
    private readonly couponsService: CouponsService,
  ) {}

  // ── Customer: Atomic Checkout & Order Placement Engine ─────────────────

  /**
   * High-integrity Atomic Checkout:
   * 1. Validates active cart items and live product variant inventory.
   * 2. Calculates real-time subtotal.
   * 3. Validates and applies coupon rules / discount caps.
   * 4. Resolves destination address and calculates dynamic shipping zone rates (with free shipping thresholds).
   * 5. Saves immutable JSON address snapshots.
   * 6. Executes atomic prisma.$transaction:
   *    - Re-validates and decrements variant inventory immediately.
   *    - Increments coupon campaign usedCount.
   *    - Inserts Order and OrderItems.
   *    - Flushes customer shopping cart.
   */
  async checkout(userId: string, checkoutDto: CheckoutDto) {
    // 1. Fetch User Shopping Cart with full variant and product data
    const userCart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!userCart || userCart.items.length === 0) {
      throw new BadRequestException(
        'Your shopping cart is empty. Add products to cart before checking out.',
      );
    }

    // 2. Validate Product Availability & Current Stock Levels
    let subtotal = 0;
    const itemsToOrder: Array<{
      productId: string;
      variantId: string;
      productTitle: string;
      sku: string;
      size: string;
      color: string;
      unitPrice: Prisma.Decimal;
      quantity: number;
      totalPrice: Prisma.Decimal;
    }> = [];

    for (const item of userCart.items) {
      const { variant, quantity } = item;
      const { product } = variant;

      if (!product.isPublished) {
        throw new BadRequestException(
          `Product "${product.title}" is currently unavailable for purchase.`,
        );
      }

      if (variant.stock < quantity) {
        throw new BadRequestException(
          `Insufficient stock for "${product.title}" (${variant.color}, ${variant.size}). Available: ${variant.stock}, Requested: ${quantity}.`,
        );
      }

      const basePrice = Number(product.discountPrice ?? product.basePrice);
      const extraPrice = Number(variant.extraPrice);
      const unitPrice = basePrice + extraPrice;
      const totalPrice = unitPrice * quantity;

      subtotal += totalPrice;

      itemsToOrder.push({
        productId: product.id,
        variantId: variant.id,
        productTitle: product.title,
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        unitPrice: new Prisma.Decimal(unitPrice),
        quantity,
        totalPrice: new Prisma.Decimal(totalPrice),
      });
    }

    subtotal = Number(subtotal.toFixed(2));

    // 3. Resolve Customer Shipping & Billing Address Snapshots
    let shippingAddressSnapshot: AddressSnapshotDto;

    if (checkoutDto.shippingAddress) {
      shippingAddressSnapshot = checkoutDto.shippingAddress;
    } else if (checkoutDto.shippingAddressId) {
      const savedAddr = await this.prisma.address.findUnique({
        where: { id: checkoutDto.shippingAddressId },
      });

      if (!savedAddr || savedAddr.userId !== userId) {
        throw new NotFoundException('Selected shipping address was not found');
      }

      shippingAddressSnapshot = {
        fullName: savedAddr.fullName,
        phone: savedAddr.phone,
        addressLine1: savedAddr.addressLine1,
        addressLine2: savedAddr.addressLine2 || undefined,
        city: savedAddr.city,
        state: savedAddr.state || undefined,
        postalCode: savedAddr.postalCode,
        country: savedAddr.country,
      };
    } else {
      // Fallback: Query customer default shipping address
      const defaultAddr = await this.prisma.address.findFirst({
        where: { userId, isDefault: true },
      });

      if (!defaultAddr) {
        throw new BadRequestException(
          'Shipping address is required. Please provide an address or select a saved address.',
        );
      }

      shippingAddressSnapshot = {
        fullName: defaultAddr.fullName,
        phone: defaultAddr.phone,
        addressLine1: defaultAddr.addressLine1,
        addressLine2: defaultAddr.addressLine2 || undefined,
        city: defaultAddr.city,
        state: defaultAddr.state || undefined,
        postalCode: defaultAddr.postalCode,
        country: defaultAddr.country,
      };
    }

    let billingAddressSnapshot: AddressSnapshotDto = shippingAddressSnapshot;
    if (checkoutDto.billingAddress) {
      billingAddressSnapshot = checkoutDto.billingAddress;
    } else if (checkoutDto.billingAddressId) {
      const savedBilling = await this.prisma.address.findUnique({
        where: { id: checkoutDto.billingAddressId },
      });
      if (savedBilling && savedBilling.userId === userId) {
        billingAddressSnapshot = {
          fullName: savedBilling.fullName,
          phone: savedBilling.phone,
          addressLine1: savedBilling.addressLine1,
          addressLine2: savedBilling.addressLine2 || undefined,
          city: savedBilling.city,
          state: savedBilling.state || undefined,
          postalCode: savedBilling.postalCode,
          country: savedBilling.country,
        };
      }
    }

    // 4. Calculate Shipping Charge & Matched Zone
    const shippingCalc = await this.shippingService.calculateShipping(
      userId,
      {
        city: shippingAddressSnapshot.city,
        postalCode: shippingAddressSnapshot.postalCode,
        shippingZoneId: checkoutDto.shippingZoneId,
        cartSubtotal: subtotal,
        deliveryType: checkoutDto.deliveryType,
      },
    );

    const shippingCost = shippingCalc.shippingCost;
    const shippingZoneId = shippingCalc.shippingZone?.id || null;

    // 5. Validate and Apply Promo Coupon (if provided)
    let discountAmount = 0;
    let appliedCouponId: string | null = null;

    if (checkoutDto.couponCode && checkoutDto.couponCode.trim()) {
      const couponValidation = await this.couponsService.validateCoupon(
        userId,
        {
          code: checkoutDto.couponCode.trim(),
          cartSubtotal: subtotal,
        },
      );

      discountAmount = couponValidation.discountAmount;
      appliedCouponId = couponValidation.couponId;
    }

    // 6. Calculate Final Total Amount
    const totalAmount = Number(
      Math.max(0, subtotal - discountAmount + shippingCost).toFixed(2),
    );

    // 7. Generate Human-Readable Unique Order Number
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ZV-${timestamp}-${randomSuffix}`;

    // 8. Execute Atomic Transaction: Decrement Stock, Save Order, Clear Cart
    const createdOrder = await this.prisma.$transaction(async (tx) => {
      // 8a. Re-verify live stock and lock inventory for each variant
      for (const item of itemsToOrder) {
        const liveVariant = await tx.productVariant.findUnique({
          where: { id: item.variantId },
          select: { id: true, stock: true, sku: true },
        });

        if (!liveVariant || liveVariant.stock < item.quantity) {
          throw new BadRequestException(
            `Stock changed during checkout. SKU ${liveVariant?.sku || item.sku} no longer has sufficient quantity.`,
          );
        }

        // Instant variant inventory decrement
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }

      // 8b. Increment coupon usedCount if coupon applied
      if (appliedCouponId) {
        await tx.coupon.update({
          where: { id: appliedCouponId },
          data: {
            usedCount: {
              increment: 1,
            },
          },
        });
      }

      // 8c. Create Order Record with address snapshots and calculated rates
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          paymentMethod: checkoutDto.paymentMethod ?? PaymentMethod.COD,
          subtotal: new Prisma.Decimal(subtotal),
          discountAmount: new Prisma.Decimal(discountAmount),
          shippingCost: new Prisma.Decimal(shippingCost),
          totalAmount: new Prisma.Decimal(totalAmount),
          couponId: appliedCouponId,
          shippingZoneId,
          shippingAddress: shippingAddressSnapshot as unknown as Prisma.InputJsonValue,
          billingAddress: billingAddressSnapshot as unknown as Prisma.InputJsonValue,
          notes: checkoutDto.notes || null,
          items: {
            create: itemsToOrder,
          },
        },
        include: {
          items: true,
          shippingZone: {
            select: {
              id: true,
              name: true,
              estimatedDeliveryDays: true,
              expressDeliveryDays: true,
            },
          },
          coupon: {
            select: {
              id: true,
              code: true,
              discountType: true,
              discountValue: true,
            },
          },
        },
      });

      // 8d. Flush customer cart items atomically
      await tx.cartItem.deleteMany({
        where: { cartId: userCart.id },
      });

      return order;
    });

    return {
      orderId: createdOrder.id,
      orderNumber: createdOrder.orderNumber,
      status: createdOrder.status,
      paymentStatus: createdOrder.paymentStatus,
      paymentMethod: createdOrder.paymentMethod,
      subtotal,
      discountAmount,
      shippingCost,
      totalAmount,
      shippingZone: createdOrder.shippingZone,
      coupon: createdOrder.coupon,
      shippingAddress: createdOrder.shippingAddress,
      billingAddress: createdOrder.billingAddress,
      items: createdOrder.items,
      createdAt: createdOrder.createdAt,
    };
  }

  // ── Customer Order History Endpoints ────────────────────────────────────

  /**
   * Customer: Get my paginated orders list.
   */
  async findMyOrders(userId: string, query: OrderQueryDto) {
    const { page = 1, limit = 10, status, paymentStatus } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      userId,
      ...(status ? { status } : {}),
      ...(paymentStatus ? { paymentStatus } : {}),
    };

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            take: 3,
          },
          shippingZone: {
            select: { name: true, estimatedDeliveryDays: true },
          },
          _count: {
            select: { items: true },
          },
        },
      }),
    ]);

    return {
      orders: orders.map((o) => ({
        ...o,
        subtotal: Number(o.subtotal),
        discountAmount: Number(o.discountAmount),
        shippingCost: Number(o.shippingCost),
        totalAmount: Number(o.totalAmount),
        itemCount: o._count.items,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Customer: Get single order details by ID.
   */
  async findMyOrderById(userId: string, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  where: { isPrimary: true },
                  take: 1,
                },
              },
            },
          },
        },
        shippingZone: true,
        coupon: true,
      },
    });

    if (!order || order.userId !== userId) {
      throw new NotFoundException(`Order with ID "${id}" was not found`);
    }

    return {
      ...order,
      subtotal: Number(order.subtotal),
      discountAmount: Number(order.discountAmount),
      shippingCost: Number(order.shippingCost),
      totalAmount: Number(order.totalAmount),
    };
  }

  /**
   * Customer: Cancel order (allowed only when status is PENDING).
   * Restores variant inventory and coupon usage in a transaction.
   */
  async cancelMyOrder(userId: string, id: string) {
    const order = await this.findMyOrderById(userId, id);

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        `Cannot cancel order with status "${order.status}". Only PENDING orders can be cancelled.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Restore Variant Inventory
      for (const item of order.items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: {
              stock: {
                increment: item.quantity,
              },
            },
          });
        }
      }

      // 2. Decrement Coupon Usage if coupon was redeemed
      if (order.couponId) {
        await tx.coupon.update({
          where: { id: order.couponId },
          data: {
            usedCount: {
              decrement: 1,
            },
          },
        });
      }

      // 3. Mark Order as CANCELLED
      return tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.CANCELLED,
        },
      });
    });
  }

  // ── Admin / Manager Order Management (CRUD & Lifecycle) ─────────────────

  /**
   * Admin: List all orders with filters, search, and pagination.
   */
  async findAll(query: OrderQueryDto) {
    const { page = 1, limit = 20, status, paymentStatus, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      ...(status ? { status } : {}),
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(search
        ? {
            OR: [
              { orderNumber: { contains: search, mode: 'insensitive' } },
              { user: { name: { contains: search, mode: 'insensitive' } } },
              { user: { email: { contains: search, mode: 'insensitive' } } },
              { user: { phone: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true },
          },
          shippingZone: {
            select: { name: true, estimatedDeliveryDays: true },
          },
          _count: {
            select: { items: true },
          },
        },
      }),
    ]);

    return {
      orders: orders.map((o) => ({
        ...o,
        subtotal: Number(o.subtotal),
        discountAmount: Number(o.discountAmount),
        shippingCost: Number(o.shippingCost),
        totalAmount: Number(o.totalAmount),
        itemCount: o._count.items,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin: Get single order details by ID.
   */
  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                slug: true,
              },
            },
            variant: {
              select: {
                id: true,
                sku: true,
                size: true,
                color: true,
                imageUrl: true,
              },
            },
          },
        },
        shippingZone: true,
        coupon: true,
        returnRequests: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID "${id}" was not found`);
    }

    return {
      ...order,
      subtotal: Number(order.subtotal),
      discountAmount: Number(order.discountAmount),
      shippingCost: Number(order.shippingCost),
      totalAmount: Number(order.totalAmount),
    };
  }

  /**
   * Admin: Update order lifecycle status.
   * If transitioning to CANCELLED and was not previously CANCELLED, restores inventory.
   */
  async updateStatus(id: string, updateDto: UpdateOrderStatusDto) {
    const order = await this.findOne(id);
    const { status, notes } = updateDto;

    // Handle inventory restoration if status changed to CANCELLED
    if (status === OrderStatus.CANCELLED && order.status !== OrderStatus.CANCELLED) {
      return this.prisma.$transaction(async (tx) => {
        for (const item of order.items) {
          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: {
                stock: {
                  increment: item.quantity,
                },
              },
            });
          }
        }

        if (order.couponId) {
          await tx.coupon.update({
            where: { id: order.couponId },
            data: {
              usedCount: {
                decrement: 1,
              },
            },
          });
        }

        return tx.order.update({
          where: { id },
          data: {
            status,
            ...(notes ? { notes } : {}),
          },
        });
      });
    }

    return this.prisma.order.update({
      where: { id },
      data: {
        status,
        ...(notes ? { notes } : {}),
      },
    });
  }

  /**
   * Admin: Update payment status.
   */
  async updatePaymentStatus(id: string, updateDto: UpdatePaymentStatusDto) {
    await this.findOne(id);

    return this.prisma.order.update({
      where: { id },
      data: {
        paymentStatus: updateDto.paymentStatus,
      },
    });
  }

  /**
   * Admin: Analytics & Sales summary metrics.
   */
  async getMetricsSummary() {
    const [
      totalOrders,
      pendingOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      paidOrdersRevenue,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: OrderStatus.PENDING } }),
      this.prisma.order.count({ where: { status: OrderStatus.PROCESSING } }),
      this.prisma.order.count({ where: { status: OrderStatus.SHIPPED } }),
      this.prisma.order.count({ where: { status: OrderStatus.DELIVERED } }),
      this.prisma.order.count({ where: { status: OrderStatus.CANCELLED } }),
      this.prisma.order.aggregate({
        where: { paymentStatus: PaymentStatus.PAID },
        _sum: { totalAmount: true },
        _avg: { totalAmount: true },
      }),
    ]);

    const totalRevenue = Number(paidOrdersRevenue._sum.totalAmount || 0);
    const averageOrderValue = Number(
      (paidOrdersRevenue._avg.totalAmount || 0).toFixed(2),
    );

    return {
      totalOrders,
      pendingOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      totalRevenue,
      averageOrderValue,
    };
  }
}
