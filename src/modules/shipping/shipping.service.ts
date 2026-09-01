import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import {
  CreateShippingZoneDto,
  UpdateShippingZoneDto,
  CalculateShippingDto,
  DeliveryType,
  ShippingZoneQueryDto,
} from './dto/index.js';

@Injectable()
export class ShippingService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Customer / Checkout: Automated Shipping Calculation Engine ──────────

  /**
   * Calculates dynamic shipping charges based on:
   * 1. Destination Postal Code or City / Area matching.
   * 2. Active Shipping Zone rules (Inside City, Suburbs, Outside City / Nationwide).
   * 3. Cart subtotal against zone Free Shipping Thresholds.
   * 4. Delivery Speed preferences (Standard vs Express / Same-day).
   */
  async calculateShipping(
    userId?: string,
    calculateDto?: CalculateShippingDto,
  ) {
    const dto = calculateDto || {};
    const {
      city,
      postalCode,
      shippingZoneId,
      deliveryType = DeliveryType.STANDARD,
    } = dto;

    // 1. Resolve Cart Subtotal (from DTO or active user cart in DB)
    let currentSubtotal = dto.cartSubtotal;

    if ((currentSubtotal === undefined || currentSubtotal === null) && userId) {
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

      if (userCart && userCart.items.length > 0) {
        currentSubtotal = userCart.items.reduce((acc, item) => {
          const base = Number(
            item.variant.product.discountPrice ??
              item.variant.product.basePrice,
          );
          const extra = Number(item.variant.extraPrice);
          return acc + (base + extra) * item.quantity;
        }, 0);
      }
    }

    // Default to 0 if no subtotal could be determined
    const subtotal = Math.max(0, currentSubtotal ?? 0);

    // 2. Fetch all active shipping zones
    const activeZones = await this.prisma.shippingZone.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    if (!activeZones.length) {
      throw new NotFoundException(
        'No active shipping zones are currently configured. Please contact support.',
      );
    }

    // 3. Match Shipping Zone
    let matchedZone = null;
    let matchReason:
      'DIRECT_ID' | 'POSTAL_CODE' | 'CITY' | 'DEFAULT_ZONE' | 'FALLBACK' =
      'FALLBACK';

    // 3a. Direct ID match
    if (shippingZoneId) {
      matchedZone = activeZones.find((z) => z.id === shippingZoneId) || null;
      if (matchedZone) {
        matchReason = 'DIRECT_ID';
      }
    }

    // 3b. Postal Code match
    if (!matchedZone && postalCode) {
      const cleanZip = postalCode.trim();
      matchedZone =
        activeZones.find((z) =>
          z.postalCodes.some(
            (code) =>
              code.toLowerCase() === cleanZip.toLowerCase() ||
              cleanZip.startsWith(code) ||
              code.startsWith(cleanZip),
          ),
        ) || null;

      if (matchedZone) {
        matchReason = 'POSTAL_CODE';
      }
    }

    // 3c. City / Area name match
    if (!matchedZone && city) {
      const cleanCity = city.trim().toLowerCase();
      matchedZone =
        activeZones.find((z) =>
          z.cities.some((c) => {
            const cityEntry = c.trim().toLowerCase();
            return (
              cleanCity === cityEntry ||
              cleanCity.includes(cityEntry) ||
              cityEntry.includes(cleanCity)
            );
          }),
        ) ||
        activeZones.find((z) => z.name.toLowerCase().includes(cleanCity)) ||
        null;

      if (matchedZone) {
        matchReason = 'CITY';
      }
    }

    // 3d. Default Zone Fallback
    if (!matchedZone) {
      matchedZone = activeZones.find((z) => z.isDefault) || null;
      if (matchedZone) {
        matchReason = 'DEFAULT_ZONE';
      }
    }

    // 3e. First active zone fallback
    if (!matchedZone) {
      matchedZone = activeZones[0];
      matchReason = 'FALLBACK';
    }

    // 4. Check Minimum Order Spend requirement
    const minOrder = matchedZone.minOrderAmount
      ? Number(matchedZone.minOrderAmount)
      : 0;
    if (minOrder > 0 && subtotal > 0 && subtotal < minOrder) {
      throw new BadRequestException(
        `Minimum order spend for shipping zone "${matchedZone.name}" is ৳${minOrder}. Current subtotal is ৳${subtotal.toFixed(2)}.`,
      );
    }

    // 5. Evaluate Free Shipping Cart Threshold
    const freeThreshold = matchedZone.freeShippingThreshold
      ? Number(matchedZone.freeShippingThreshold)
      : null;
    const isFreeShipping =
      freeThreshold !== null && freeThreshold > 0 && subtotal >= freeThreshold;

    const amountNeededForFreeShipping =
      freeThreshold !== null && !isFreeShipping
        ? Number(Math.max(0, freeThreshold - subtotal).toFixed(2))
        : 0;

    const freeShippingProgressPercent =
      freeThreshold !== null && freeThreshold > 0
        ? Math.min(100, Math.round((subtotal / freeThreshold) * 100))
        : isFreeShipping
          ? 100
          : 0;

    let freeShippingMessage = 'Standard delivery rates apply.';
    if (isFreeShipping) {
      freeShippingMessage = `🎉 Free shipping unlocked for orders over ৳${freeThreshold}!`;
    } else if (freeThreshold !== null && amountNeededForFreeShipping > 0) {
      freeShippingMessage = `Add ৳${amountNeededForFreeShipping.toFixed(2)} more to your cart to get FREE standard delivery!`;
    }

    // 6. Multi-Tier Courier Rates Calculation
    const standardCost = Number(matchedZone.cost);
    const calculatedStandardCost = isFreeShipping ? 0 : standardCost;

    const standardOption = {
      type: DeliveryType.STANDARD,
      name: 'Standard Delivery',
      baseRate: standardCost,
      finalRate: calculatedStandardCost,
      isFree: isFreeShipping,
      estimatedDeliveryDays: matchedZone.estimatedDeliveryDays,
      description: `Delivery within ${matchedZone.estimatedDeliveryDays}`,
    };

    const hasExpress =
      matchedZone.expressCost !== null && matchedZone.expressCost !== undefined;
    const expressCost = hasExpress ? Number(matchedZone.expressCost) : null;

    const expressOption = hasExpress
      ? {
          type: DeliveryType.EXPRESS,
          name: 'Express / Fast Delivery',
          baseRate: expressCost!,
          finalRate: expressCost!,
          isFree: false,
          estimatedDeliveryDays:
            matchedZone.expressDeliveryDays || 'Same-Day Delivery',
          description:
            matchedZone.expressDeliveryDays || 'Fast express doorstep delivery',
        }
      : null;

    const availableRates = [standardOption];
    if (expressOption) {
      availableRates.push(expressOption);
    }

    // 7. Determine Final Charged Shipping Cost based on deliveryType selection
    let selectedRate = standardOption;
    if (deliveryType === DeliveryType.EXPRESS && expressOption) {
      selectedRate = expressOption;
    }

    const shippingCost = selectedRate.finalRate;
    const finalTotal = Number((subtotal + shippingCost).toFixed(2));

    return {
      shippingZone: {
        id: matchedZone.id,
        name: matchedZone.name,
        code: matchedZone.code,
        description: matchedZone.description,
        estimatedDeliveryDays: matchedZone.estimatedDeliveryDays,
        expressDeliveryDays: matchedZone.expressDeliveryDays,
        isDefault: matchedZone.isDefault,
      },
      matchReason,
      selectedDeliveryType: selectedRate.type,
      shippingCost,
      cartSubtotal: Number(subtotal.toFixed(2)),
      finalTotal,
      freeShipping: {
        isFreeShipping,
        threshold: freeThreshold,
        amountNeeded: amountNeededForFreeShipping,
        progressPercent: freeShippingProgressPercent,
        message: freeShippingMessage,
      },
      availableRates,
    };
  }

  // ── Public Storefront Endpoint ──────────────────────────────────────────

  /**
   * Public: List all active shipping zones with standard rates and delivery info
   * for customer storefront information and checkout dropdowns.
   */
  async findAllPublic() {
    const zones = await this.prisma.shippingZone.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        cities: true,
        cost: true,
        expressCost: true,
        freeShippingThreshold: true,
        minOrderAmount: true,
        estimatedDeliveryDays: true,
        expressDeliveryDays: true,
        isDefault: true,
      },
    });

    return zones.map((zone) => ({
      ...zone,
      cost: Number(zone.cost),
      expressCost: zone.expressCost ? Number(zone.expressCost) : null,
      freeShippingThreshold: zone.freeShippingThreshold
        ? Number(zone.freeShippingThreshold)
        : null,
      minOrderAmount: zone.minOrderAmount ? Number(zone.minOrderAmount) : 0,
    }));
  }

  // ── Admin Shipping Zones Management (CRUD) ──────────────────────────────

  /**
   * Admin/Manager: Create a new shipping zone.
   */
  async create(createDto: CreateShippingZoneDto) {
    const { code, isDefault, ...rest } = createDto;

    // Check code uniqueness if code is supplied
    if (code) {
      const cleanCode = code.trim().toUpperCase();
      const existing = await this.prisma.shippingZone.findUnique({
        where: { code: cleanCode },
      });

      if (existing) {
        throw new ConflictException(
          `Shipping zone with code "${cleanCode}" already exists`,
        );
      }
    }

    // If marked as default, unset existing default zones
    if (isDefault) {
      await this.prisma.shippingZone.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.shippingZone.create({
      data: {
        ...rest,
        code: code ? code.trim().toUpperCase() : null,
        isDefault: isDefault ?? false,
        cities: rest.cities ?? [],
        postalCodes: rest.postalCodes ?? [],
      },
    });
  }

  /**
   * Admin/Manager: List all shipping zones with pagination, search, and metrics.
   */
  async findAll(query: ShippingZoneQueryDto) {
    const { page = 1, limit = 20, isActive, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ShippingZoneWhereInput = {
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { cities: { has: search } },
              { postalCodes: { has: search } },
            ],
          }
        : {}),
    };

    const [total, zones] = await Promise.all([
      this.prisma.shippingZone.count({ where }),
      this.prisma.shippingZone.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: {
          _count: {
            select: { orders: true },
          },
        },
      }),
    ]);

    const formattedZones = zones.map((zone) => ({
      ...zone,
      cost: Number(zone.cost),
      expressCost: zone.expressCost ? Number(zone.expressCost) : null,
      freeShippingThreshold: zone.freeShippingThreshold
        ? Number(zone.freeShippingThreshold)
        : null,
      minOrderAmount: zone.minOrderAmount ? Number(zone.minOrderAmount) : 0,
      totalOrdersCount: zone._count.orders,
    }));

    return {
      zones: formattedZones,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin/Manager: Get single shipping zone details by ID.
   */
  async findOne(id: string) {
    const zone = await this.prisma.shippingZone.findUnique({
      where: { id },
      include: {
        _count: {
          select: { orders: true },
        },
      },
    });

    if (!zone) {
      throw new NotFoundException(`Shipping zone with ID "${id}" not found`);
    }

    return {
      ...zone,
      cost: Number(zone.cost),
      expressCost: zone.expressCost ? Number(zone.expressCost) : null,
      freeShippingThreshold: zone.freeShippingThreshold
        ? Number(zone.freeShippingThreshold)
        : null,
      minOrderAmount: zone.minOrderAmount ? Number(zone.minOrderAmount) : 0,
      totalOrdersCount: zone._count.orders,
    };
  }

  /**
   * Admin/Manager: Update a shipping zone configuration.
   */
  async update(id: string, updateDto: UpdateShippingZoneDto) {
    await this.findOne(id);

    const { code, isDefault, ...rest } = updateDto;

    // Check code collision if code updated
    if (code) {
      const cleanCode = code.trim().toUpperCase();
      const existing = await this.prisma.shippingZone.findUnique({
        where: { code: cleanCode },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Shipping zone code "${cleanCode}" is already in use`,
        );
      }
    }

    // If marked as default, unset other default zones
    if (isDefault) {
      await this.prisma.shippingZone.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return this.prisma.shippingZone.update({
      where: { id },
      data: {
        ...rest,
        ...(code ? { code: code.trim().toUpperCase() } : {}),
        ...(isDefault !== undefined ? { isDefault } : {}),
      },
    });
  }

  /**
   * Admin/Manager: Toggle shipping zone active/inactive status.
   */
  async toggleStatus(id: string) {
    const zone = await this.findOne(id);

    return this.prisma.shippingZone.update({
      where: { id },
      data: {
        isActive: !zone.isActive,
      },
    });
  }

  /**
   * Admin/Manager: Mark a shipping zone as the default fallback zone.
   */
  async setDefault(id: string) {
    await this.findOne(id);

    // Unset all defaults
    await this.prisma.shippingZone.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });

    // Set selected as default and ensure it's active
    return this.prisma.shippingZone.update({
      where: { id },
      data: {
        isDefault: true,
        isActive: true,
      },
    });
  }

  /**
   * Admin: Delete a shipping zone (with order relation safety check).
   */
  async remove(id: string) {
    const zone = await this.findOne(id);

    if (zone.totalOrdersCount > 0) {
      throw new BadRequestException(
        `Cannot delete shipping zone "${zone.name}" because it is referenced in ${zone.totalOrdersCount} existing order(s). Disable it instead.`,
      );
    }

    return this.prisma.shippingZone.delete({
      where: { id },
    });
  }
}
