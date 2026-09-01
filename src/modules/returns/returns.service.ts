import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  Prisma,
  OrderStatus,
  ReturnStatus,
  ReturnResolution,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import {
  CreateReturnRequestDto,
  UpdateReturnStatusDto,
  ReturnQueryDto,
  TrackReturnDto,
} from './dto/index.js';

@Injectable()
export class ReturnsService {
  private readonly logger = new Logger(ReturnsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Customer: Self-Service Return Request Creation ──────────────────────

  /**
   * Customer: Creates a self-service return request with proof photos,
   * resolution choice (REFUND / EXCHANGE), and generates a unique tracking reference.
   */
  async create(userId: string, createDto: CreateReturnRequestDto) {
    const {
      orderId,
      orderItemId,
      reason,
      resolution = ReturnResolution.REFUND,
      exchangeVariantId,
      proofImages = [],
      pickupAddress,
    } = createDto;

    // 1. Fetch Order and verify ownership
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID "${orderId}" was not found`);
    }

    if (order.userId !== userId) {
      throw new BadRequestException(
        'You do not have permission to return items from this order',
      );
    }

    // 2. Validate Order Status (Must be DELIVERED)
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException(
        `Return requests can only be initiated for DELIVERED orders. Current order status: "${order.status}"`,
      );
    }

    // 3. Check 14-Day Return Policy Window
    const daysSinceDelivery = Math.floor(
      (Date.now() - new Date(order.updatedAt).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (daysSinceDelivery > 14) {
      throw new BadRequestException(
        `Return policy window expired. Returns must be requested within 14 days of delivery (${daysSinceDelivery} days elapsed).`,
      );
    }

    // 4. Verify Order Item belongs to Order
    const orderItem = order.items.find((item) => item.id === orderItemId);
    if (!orderItem) {
      throw new NotFoundException(
        'The specified item does not belong to this order',
      );
    }

    // 5. Prevent Duplicate Active Return Requests for the same item
    const existingReturn = await this.prisma.returnRequest.findFirst({
      where: {
        orderItemId,
        status: { notIn: [ReturnStatus.REJECTED] },
      },
    });

    if (existingReturn) {
      throw new BadRequestException(
        `An active return request (${existingReturn.returnReference}) is already processing for this item.`,
      );
    }

    // 6. Validate Exchange Variant (if EXCHANGE chosen)
    if (resolution === ReturnResolution.EXCHANGE) {
      if (!exchangeVariantId) {
        throw new BadRequestException(
          'exchangeVariantId is required when resolution is set to EXCHANGE',
        );
      }

      const exchangeVariant = await this.prisma.productVariant.findUnique({
        where: { id: exchangeVariantId },
        include: { product: true },
      });

      if (!exchangeVariant || !exchangeVariant.product.isPublished) {
        throw new NotFoundException(
          'The requested exchange product variant is unavailable',
        );
      }

      if (exchangeVariant.stock <= 0) {
        throw new BadRequestException(
          `The requested exchange size/color (${exchangeVariant.size}, ${exchangeVariant.color}) is currently out of stock. Please select another variant or choose REFUND.`,
        );
      }
    }

    // 7. Generate Unique Tracking Reference (e.g. RET-20260901-4821)
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const returnReference = `RET-${timestamp}-${randomSuffix}`;

    // 8. Create Return Request in Database
    const resolvedPickup = pickupAddress || order.shippingAddress;
    const estimatedRefund =
      resolution === ReturnResolution.REFUND ? orderItem.totalPrice : null;

    const returnRequest = await this.prisma.returnRequest.create({
      data: {
        returnReference,
        orderId,
        orderItemId,
        userId,
        reason: reason.trim(),
        resolution,
        exchangeVariantId:
          resolution === ReturnResolution.EXCHANGE ? exchangeVariantId : null,
        status: ReturnStatus.REQUESTED,
        proofImages,
        pickupAddress: resolvedPickup as unknown as Prisma.InputJsonValue,
        refundAmount: estimatedRefund,
      },
      include: {
        orderItem: {
          include: {
            product: { select: { id: true, title: true, slug: true } },
            variant: {
              select: { id: true, sku: true, size: true, color: true },
            },
          },
        },
      },
    });

    this.logger.log(
      `🔄 Self-service return request created: ${returnReference} for Order #${order.orderNumber}`,
    );

    return {
      returnId: returnRequest.id,
      returnReference: returnRequest.returnReference,
      status: returnRequest.status,
      resolution: returnRequest.resolution,
      reason: returnRequest.reason,
      proofImages: returnRequest.proofImages,
      estimatedRefundAmount: returnRequest.refundAmount
        ? Number(returnRequest.refundAmount)
        : null,
      orderNumber: order.orderNumber,
      item: {
        productTitle: returnRequest.orderItem.productTitle,
        sku: returnRequest.orderItem.sku,
        size: returnRequest.orderItem.size,
        color: returnRequest.orderItem.color,
        quantity: returnRequest.orderItem.quantity,
        totalPrice: Number(returnRequest.orderItem.totalPrice),
      },
      pickupAddress: returnRequest.pickupAddress,
      createdAt: returnRequest.createdAt,
    };
  }

  // ── Public Return Tracking ──────────────────────────────────────────────

  /**
   * Public: Track Return Request status by returnReference + email/phone verification.
   */
  async trackReturn(trackDto: TrackReturnDto) {
    const { returnReference, emailOrPhone } = trackDto;
    const cleanRef = returnReference.trim().toUpperCase();
    const cleanInput = emailOrPhone.trim().toLowerCase();
    const digitsOnlyInput = cleanInput.replace(/\D/g, '');

    const returnReq = await this.prisma.returnRequest.findUnique({
      where: { returnReference: cleanRef },
      include: {
        order: {
          include: {
            user: { select: { name: true, email: true, phone: true } },
          },
        },
        orderItem: true,
      },
    });

    if (!returnReq) {
      throw new NotFoundException(
        `Return reference "${cleanRef}" was not found.`,
      );
    }

    const pickupAddr =
      (returnReq.pickupAddress as Record<string, unknown>) || {};
    const returnEmail = (
      returnReq.order.user?.email ||
      (pickupAddr.email as string) ||
      ''
    ).toLowerCase();
    const returnPhone = (
      returnReq.order.user?.phone ||
      (pickupAddr.phone as string) ||
      ''
    ).replace(/\D/g, '');

    const isEmailMatch = returnEmail && returnEmail === cleanInput;
    const isPhoneMatch =
      Boolean(digitsOnlyInput) &&
      Boolean(returnPhone) &&
      (returnPhone.includes(digitsOnlyInput) ||
        digitsOnlyInput.includes(returnPhone));

    if (!isEmailMatch && !isPhoneMatch) {
      throw new NotFoundException(
        'The phone number or email address does not match this return record.',
      );
    }

    // Determine Return Stepper Stages
    const isRejected = returnReq.status === ReturnStatus.REJECTED;
    const returnStages: ReturnStatus[] = [
      ReturnStatus.REQUESTED,
      ReturnStatus.APPROVED,
      ReturnStatus.RECEIVED,
      ReturnStatus.REFUNDED,
    ];
    const currentIndex = returnStages.indexOf(returnReq.status);

    const steps = [
      {
        key: 'REQUESTED',
        title: 'Return Requested',
        description:
          'Return application submitted and under review by our quality team.',
        completed: !isRejected && currentIndex >= 0,
        current: returnReq.status === ReturnStatus.REQUESTED,
        timestamp: returnReq.createdAt,
      },
      {
        key: 'APPROVED',
        title: 'Return Approved',
        description: 'Return approved. Courier scheduled for reverse pickup.',
        completed: !isRejected && currentIndex >= 1,
        current: returnReq.status === ReturnStatus.APPROVED,
        timestamp: currentIndex >= 1 ? returnReq.updatedAt : null,
      },
      {
        key: 'RECEIVED',
        title: 'Item Received at Warehouse',
        description: 'Item arrived at our facility and inspection completed.',
        completed: !isRejected && currentIndex >= 2,
        current: returnReq.status === ReturnStatus.RECEIVED,
        timestamp: currentIndex >= 2 ? returnReq.updatedAt : null,
      },
      {
        key:
          returnReq.resolution === ReturnResolution.REFUND
            ? 'REFUNDED'
            : 'EXCHANGE_DISPATCHED',
        title:
          returnReq.resolution === ReturnResolution.REFUND
            ? 'Refund Processed'
            : 'Exchange Item Dispatched',
        description:
          returnReq.resolution === ReturnResolution.REFUND
            ? `Refund of ৳${Number(returnReq.refundAmount || returnReq.orderItem.totalPrice).toFixed(2)} issued.`
            : 'New replacement item shipped to your address.',
        completed: !isRejected && currentIndex >= 3,
        current: returnReq.status === ReturnStatus.REFUNDED,
        timestamp: currentIndex >= 3 ? returnReq.updatedAt : null,
      },
    ];

    return {
      returnReference: returnReq.returnReference,
      status: returnReq.status,
      resolution: returnReq.resolution,
      isRejected,
      rejectionReason: isRejected ? returnReq.adminNotes : null,
      currentStepIndex: currentIndex >= 0 ? currentIndex : isRejected ? -1 : 0,
      steps,
      orderNumber: returnReq.order.orderNumber,
      item: {
        productTitle: returnReq.orderItem.productTitle,
        sku: returnReq.orderItem.sku,
        size: returnReq.orderItem.size,
        color: returnReq.orderItem.color,
        quantity: returnReq.orderItem.quantity,
        totalPrice: Number(returnReq.orderItem.totalPrice),
      },
      reason: returnReq.reason,
      proofImages: returnReq.proofImages,
      trackingNumber: returnReq.trackingNumber,
      refundAmount: returnReq.refundAmount
        ? Number(returnReq.refundAmount)
        : null,
      adminNotes: returnReq.adminNotes,
      createdAt: returnReq.createdAt,
      updatedAt: returnReq.updatedAt,
    };
  }

  // ── Customer Return History Endpoints ───────────────────────────────────

  /**
   * Customer: Get list of my return requests with pagination.
   */
  async findMyReturns(userId: string, query: ReturnQueryDto) {
    const { page = 1, limit = 10, status, resolution } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ReturnRequestWhereInput = {
      userId,
      ...(status ? { status } : {}),
      ...(resolution ? { resolution } : {}),
    };

    const [total, returns] = await Promise.all([
      this.prisma.returnRequest.count({ where }),
      this.prisma.returnRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          order: { select: { orderNumber: true, status: true } },
          orderItem: {
            select: {
              productTitle: true,
              sku: true,
              size: true,
              color: true,
              quantity: true,
              totalPrice: true,
            },
          },
        },
      }),
    ]);

    return {
      returns: returns.map((r) => ({
        ...r,
        refundAmount: r.refundAmount ? Number(r.refundAmount) : null,
        orderItem: {
          ...r.orderItem,
          totalPrice: Number(r.orderItem.totalPrice),
        },
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
   * Customer: Get single return request by ID.
   */
  async findMyReturnById(userId: string, id: string) {
    const returnReq = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: {
        order: { select: { id: true, orderNumber: true, createdAt: true } },
        orderItem: true,
      },
    });

    if (!returnReq || returnReq.userId !== userId) {
      throw new NotFoundException(
        `Return request with ID "${id}" was not found`,
      );
    }

    return {
      ...returnReq,
      refundAmount: returnReq.refundAmount
        ? Number(returnReq.refundAmount)
        : null,
      orderItem: {
        ...returnReq.orderItem,
        unitPrice: Number(returnReq.orderItem.unitPrice),
        totalPrice: Number(returnReq.orderItem.totalPrice),
      },
    };
  }

  // ── Admin / Manager Return Management ───────────────────────────────────

  /**
   * Admin: List all returns with search and filters.
   */
  async findAll(query: ReturnQueryDto) {
    const { page = 1, limit = 20, status, resolution, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ReturnRequestWhereInput = {
      ...(status ? { status } : {}),
      ...(resolution ? { resolution } : {}),
      ...(search
        ? {
            OR: [
              { returnReference: { contains: search, mode: 'insensitive' } },
              {
                order: {
                  orderNumber: { contains: search, mode: 'insensitive' },
                },
              },
              { user: { name: { contains: search, mode: 'insensitive' } } },
              { user: { email: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [total, returns] = await Promise.all([
      this.prisma.returnRequest.count({ where }),
      this.prisma.returnRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          order: { select: { id: true, orderNumber: true } },
          orderItem: {
            select: {
              productTitle: true,
              sku: true,
              size: true,
              color: true,
              totalPrice: true,
            },
          },
        },
      }),
    ]);

    return {
      returns: returns.map((r) => ({
        ...r,
        refundAmount: r.refundAmount ? Number(r.refundAmount) : null,
        orderItem: {
          ...r.orderItem,
          totalPrice: Number(r.orderItem.totalPrice),
        },
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
   * Admin: Get single return details by ID.
   */
  async findOne(id: string) {
    const returnReq = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        order: {
          include: {
            items: true,
          },
        },
        orderItem: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    if (!returnReq) {
      throw new NotFoundException(
        `Return request with ID "${id}" was not found`,
      );
    }

    return {
      ...returnReq,
      refundAmount: returnReq.refundAmount
        ? Number(returnReq.refundAmount)
        : null,
      orderItem: {
        ...returnReq.orderItem,
        unitPrice: Number(returnReq.orderItem.unitPrice),
        totalPrice: Number(returnReq.orderItem.totalPrice),
      },
    };
  }

  /**
   * Admin: Update return request status, admin notes, refund amount, or tracking number.
   * If status becomes RECEIVED and resolution was EXCHANGE/REFUND, inventory can be restored.
   */
  async updateStatus(id: string, updateDto: UpdateReturnStatusDto) {
    const returnReq = await this.findOne(id);
    const { status, adminNotes, refundAmount, trackingNumber } = updateDto;

    // Optional: If return is RECEIVED, restore returned variant stock
    if (
      status === ReturnStatus.RECEIVED &&
      returnReq.status !== ReturnStatus.RECEIVED
    ) {
      if (returnReq.orderItem.variantId) {
        await this.prisma.productVariant.update({
          where: { id: returnReq.orderItem.variantId },
          data: {
            stock: {
              increment: returnReq.orderItem.quantity,
            },
          },
        });
        this.logger.log(
          `📦 Restocked returned variant (${returnReq.orderItem.sku}, +${returnReq.orderItem.quantity} qty)`,
        );
      }
    }

    return this.prisma.returnRequest.update({
      where: { id },
      data: {
        status,
        ...(adminNotes !== undefined ? { adminNotes } : {}),
        ...(refundAmount !== undefined
          ? { refundAmount: new Prisma.Decimal(refundAmount) }
          : {}),
        ...(trackingNumber !== undefined ? { trackingNumber } : {}),
      },
      include: {
        order: { select: { orderNumber: true } },
        orderItem: { select: { productTitle: true, sku: true } },
      },
    });
  }

  /**
   * Admin: Approve return request.
   */
  async approveReturn(
    id: string,
    adminNotes?: string,
    trackingNumber?: string,
  ) {
    return this.updateStatus(id, {
      status: ReturnStatus.APPROVED,
      adminNotes:
        adminNotes || 'Return approved. Awaiting item arrival at warehouse.',
      trackingNumber,
    });
  }

  /**
   * Admin: Reject return request with mandatory reason.
   */
  async rejectReturn(id: string, rejectionReason: string) {
    if (!rejectionReason || !rejectionReason.trim()) {
      throw new BadRequestException(
        'Rejection reason (adminNotes) is required to decline a return request',
      );
    }
    return this.updateStatus(id, {
      status: ReturnStatus.REJECTED,
      adminNotes: rejectionReason.trim(),
    });
  }

  /**
   * Admin: Receive returned item at warehouse and automatically restock inventory.
   */
  async receiveReturn(id: string, adminNotes?: string) {
    return this.updateStatus(id, {
      status: ReturnStatus.RECEIVED,
      adminNotes:
        adminNotes ||
        'Item received at warehouse and quality inspection completed.',
    });
  }

  /**
   * Admin: Process refund or finalize exchange.
   */
  async refundReturn(id: string, refundAmount?: number, adminNotes?: string) {
    const returnReq = await this.findOne(id);
    const amount =
      refundAmount !== undefined
        ? refundAmount
        : Number(returnReq.refundAmount || returnReq.orderItem.totalPrice);

    return this.updateStatus(id, {
      status: ReturnStatus.REFUNDED,
      refundAmount: amount,
      adminNotes:
        adminNotes || 'Refund processed to customer original payment method.',
    });
  }
}
