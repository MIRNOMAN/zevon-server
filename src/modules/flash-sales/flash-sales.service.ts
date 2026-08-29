import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import {
  CreateFlashSaleDto,
  UpdateFlashSaleDto,
  ClaimStockDto,
} from './dto/index.js';

export interface CountdownTimer {
  serverTime: string;
  startTime: string;
  endTime: string;
  status: 'LIVE' | 'UPCOMING' | 'ENDED';
  timeRemainingMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

@Injectable()
export class FlashSalesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Public Campaign Endpoints ────────────────────────────────

  /**
   * Public: Get currently active LIVE flash sale campaign with countdown timer
   * and real-time stock claim progress percentage.
   */
  async getActiveFlashSale() {
    const now = new Date();

    const campaign = await this.prisma.flashSale.findFirst({
      where: {
        isActive: true,
        startTime: { lte: now },
        endTime: { gte: now },
      },
      orderBy: { endTime: 'asc' },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                slug: true,
                basePrice: true,
                discountPrice: true,
                category: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
                images: {
                  select: {
                    url: true,
                    altText: true,
                    isPrimary: true,
                  },
                  orderBy: { isPrimary: 'desc' },
                  take: 2,
                },
                variants: {
                  select: {
                    id: true,
                    sku: true,
                    size: true,
                    color: true,
                    colorCode: true,
                    stock: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!campaign) {
      return null;
    }

    return this.formatCampaignResponse(campaign, now);
  }

  /**
   * Public: Get upcoming flash sale campaigns.
   */
  async getUpcomingFlashSales() {
    const now = new Date();

    const campaigns = await this.prisma.flashSale.findMany({
      where: {
        isActive: true,
        startTime: { gt: now },
      },
      orderBy: { startTime: 'asc' },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                slug: true,
                basePrice: true,
                images: {
                  select: { url: true, isPrimary: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    return campaigns.map((c) => this.formatCampaignResponse(c, now));
  }

  /**
   * Public: Get single flash sale campaign by slug with live metrics.
   */
  async getCampaignBySlug(slug: string) {
    const now = new Date();

    const campaign = await this.prisma.flashSale.findUnique({
      where: { slug },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                slug: true,
                description: true,
                basePrice: true,
                discountPrice: true,
                category: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
                images: {
                  select: {
                    url: true,
                    altText: true,
                    isPrimary: true,
                  },
                  orderBy: { isPrimary: 'desc' },
                },
                variants: {
                  select: {
                    id: true,
                    sku: true,
                    size: true,
                    color: true,
                    colorCode: true,
                    stock: true,
                    extraPrice: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException(`Flash sale "${slug}" not found`);
    }

    return this.formatCampaignResponse(campaign, now);
  }

  // ── Admin Campaign Operations ────────────────────────────────

  /**
   * Admin: Create a new flash sale campaign with linked products and stock allocations.
   */
  async create(createFlashSaleDto: CreateFlashSaleDto) {
    const { items, slug, startTime, endTime, ...rest } = createFlashSaleDto;

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    if (startDate >= endDate) {
      throw new BadRequestException('startTime must be before endTime');
    }

    const generatedSlug = slug
      ? this.slugify(slug)
      : this.slugify(createFlashSaleDto.title);

    const existing = await this.prisma.flashSale.findUnique({
      where: { slug: generatedSlug },
    });

    if (existing) {
      throw new ConflictException(
        `Flash sale with slug "${generatedSlug}" already exists`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const campaign = await tx.flashSale.create({
        data: {
          ...rest,
          slug: generatedSlug,
          startTime: startDate,
          endTime: endDate,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              discountPrice: item.discountPrice,
              discountPercent: item.discountPercent,
              quantityLimit: item.quantityLimit,
              soldCount: item.soldCount ?? 0,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  basePrice: true,
                },
              },
            },
          },
        },
      });

      return this.formatCampaignResponse(campaign, new Date());
    });
  }

  /**
   * Admin: List all campaigns with status filtering and metrics.
   */
  async findAll(
    page = 1,
    limit = 20,
    status?: 'LIVE' | 'UPCOMING' | 'ENDED' | 'INACTIVE',
    search?: string,
  ) {
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: Prisma.FlashSaleWhereInput = {
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    if (status === 'LIVE') {
      where.isActive = true;
      where.startTime = { lte: now };
      where.endTime = { gte: now };
    } else if (status === 'UPCOMING') {
      where.isActive = true;
      where.startTime = { gt: now };
    } else if (status === 'ENDED') {
      where.endTime = { lt: now };
    } else if (status === 'INACTIVE') {
      where.isActive = false;
    }

    const [total, campaigns] = await Promise.all([
      this.prisma.flashSale.count({ where }),
      this.prisma.flashSale.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ startTime: 'desc' }],
        include: {
          _count: {
            select: {
              items: true,
            },
          },
          items: {
            select: {
              quantityLimit: true,
              soldCount: true,
            },
          },
        },
      }),
    ]);

    return {
      campaigns: campaigns.map((c) => {
        const totalAllocated = c.items.reduce(
          (acc, item) => acc + item.quantityLimit,
          0,
        );
        const totalClaimed = c.items.reduce(
          (acc, item) => acc + item.soldCount,
          0,
        );
        const overallProgress =
          totalAllocated > 0
            ? Math.min(100, Math.round((totalClaimed / totalAllocated) * 100))
            : 0;

        const campaignStatus: 'LIVE' | 'UPCOMING' | 'ENDED' =
          now < c.startTime ? 'UPCOMING' : now > c.endTime ? 'ENDED' : 'LIVE';

        return {
          id: c.id,
          title: c.title,
          slug: c.slug,
          bannerUrl: c.bannerUrl,
          discountPercent: c.discountPercent,
          startTime: c.startTime,
          endTime: c.endTime,
          isActive: c.isActive,
          status: c.isActive ? campaignStatus : 'INACTIVE',
          productCount: c._count.items,
          totalAllocatedStock: totalAllocated,
          totalClaimedStock: totalClaimed,
          overallClaimProgressPercentage: overallProgress,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        };
      }),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin: Get single campaign with items.
   */
  async findOne(id: string) {
    const campaign = await this.prisma.flashSale.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                slug: true,
                basePrice: true,
                discountPrice: true,
                images: {
                  select: { url: true, isPrimary: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException(`Flash sale with ID "${id}" not found`);
    }

    return this.formatCampaignResponse(campaign, new Date());
  }

  /**
   * Admin: Update campaign fields and items.
   */
  async update(id: string, updateFlashSaleDto: UpdateFlashSaleDto) {
    await this.findOne(id);

    const { items, slug, startTime, endTime, ...rest } = updateFlashSaleDto;

    const dataToUpdate: Prisma.FlashSaleUpdateInput = {
      ...rest,
      ...(slug ? { slug: this.slugify(slug) } : {}),
      ...(startTime ? { startTime: new Date(startTime) } : {}),
      ...(endTime ? { endTime: new Date(endTime) } : {}),
    };

    return this.prisma.$transaction(async (tx) => {
      if (items !== undefined) {
        await tx.flashSaleItem.deleteMany({
          where: { flashSaleId: id },
        });

        if (items.length > 0) {
          await tx.flashSaleItem.createMany({
            data: items.map((item) => ({
              flashSaleId: id,
              productId: item.productId,
              discountPrice: item.discountPrice,
              discountPercent: item.discountPercent,
              quantityLimit: item.quantityLimit,
              soldCount: item.soldCount ?? 0,
            })),
          });
        }
      }

      const updated = await tx.flashSale.update({
        where: { id },
        data: dataToUpdate,
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  basePrice: true,
                },
              },
            },
          },
        },
      });

      return this.formatCampaignResponse(updated, new Date());
    });
  }

  /**
   * Admin: Toggle campaign active status.
   */
  async toggleStatus(id: string) {
    const campaign = await this.findOne(id);

    return this.prisma.flashSale.update({
      where: { id },
      data: {
        isActive: !campaign.isActive,
      },
    });
  }

  /**
   * Atomically claim / reserve flash sale stock during checkout/order placement.
   */
  async claimStock(flashSaleId: string, claimStockDto: ClaimStockDto) {
    const now = new Date();

    const flashSaleItem = await this.prisma.flashSaleItem.findUnique({
      where: {
        flashSaleId_productId: {
          flashSaleId,
          productId: claimStockDto.productId,
        },
      },
      include: {
        flashSale: true,
      },
    });

    if (!flashSaleItem) {
      throw new NotFoundException(
        'Product is not part of this flash sale campaign',
      );
    }

    if (
      !flashSaleItem.flashSale.isActive ||
      now < flashSaleItem.flashSale.startTime ||
      now > flashSaleItem.flashSale.endTime
    ) {
      throw new BadRequestException(
        'Flash sale campaign is not currently active',
      );
    }

    const available = flashSaleItem.quantityLimit - flashSaleItem.soldCount;
    if (available < claimStockDto.quantity) {
      throw new BadRequestException(
        `Flash sale stock limit reached. Only ${Math.max(0, available)} units remaining.`,
      );
    }

    const updated = await this.prisma.flashSaleItem.update({
      where: {
        id: flashSaleItem.id,
      },
      data: {
        soldCount: {
          increment: claimStockDto.quantity,
        },
      },
    });

    const newClaimPercentage = Math.min(
      100,
      Math.round((updated.soldCount / updated.quantityLimit) * 100),
    );

    return {
      claimed: true,
      flashSaleId,
      productId: claimStockDto.productId,
      quantityClaimed: claimStockDto.quantity,
      totalSaleStock: updated.quantityLimit,
      claimedStock: updated.soldCount,
      availableStock: updated.quantityLimit - updated.soldCount,
      claimPercentage: newClaimPercentage,
      isSoldOut: updated.soldCount >= updated.quantityLimit,
    };
  }

  /**
   * Admin: Delete campaign.
   */
  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.flashSale.delete({
      where: { id },
    });
  }

  // ── Helper Formatter ─────────────────────────────────────────

  private formatCampaignResponse<
    T extends {
      id: string;
      title: string;
      slug: string;
      description?: string | null;
      bannerUrl?: string | null;
      discountPercent?: number | null;
      startTime: Date;
      endTime: Date;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
      items: Array<{
        id: string;
        discountPrice: Prisma.Decimal;
        discountPercent?: number | null;
        quantityLimit: number;
        soldCount: number;
        product?: unknown;
      }>;
    },
  >(campaign: T, now: Date) {
    const countdown = this.calculateCountdown(
      campaign.startTime,
      campaign.endTime,
      now,
    );

    const formattedItems = campaign.items.map((item) => {
      const claimPercentage =
        item.quantityLimit > 0
          ? Math.min(
              100,
              Math.round((item.soldCount / item.quantityLimit) * 100),
            )
          : 0;

      return {
        id: item.id,
        discountPrice: item.discountPrice,
        discountPercent: item.discountPercent,
        totalSaleStock: item.quantityLimit,
        claimedStock: item.soldCount,
        availableStock: Math.max(0, item.quantityLimit - item.soldCount),
        claimPercentage,
        isSoldOut: item.soldCount >= item.quantityLimit,
        product: item.product,
      };
    });

    return {
      id: campaign.id,
      title: campaign.title,
      slug: campaign.slug,
      description: campaign.description,
      bannerUrl: campaign.bannerUrl,
      discountPercent: campaign.discountPercent,
      startTime: campaign.startTime,
      endTime: campaign.endTime,
      isActive: campaign.isActive,
      countdown,
      items: formattedItems,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    };
  }

  private calculateCountdown(
    startTime: Date,
    endTime: Date,
    now: Date,
  ): CountdownTimer {
    const startMs = startTime.getTime();
    const endMs = endTime.getTime();
    const nowMs = now.getTime();

    let status: 'LIVE' | 'UPCOMING' | 'ENDED' = 'LIVE';
    let targetMs = endMs;

    if (nowMs < startMs) {
      status = 'UPCOMING';
      targetMs = startMs;
    } else if (nowMs > endMs) {
      status = 'ENDED';
      targetMs = endMs;
    }

    const timeRemainingMs = Math.max(0, targetMs - nowMs);
    const totalSeconds = Math.floor(timeRemainingMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return {
      serverTime: now.toISOString(),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      status,
      timeRemainingMs,
      days,
      hours,
      minutes,
      seconds,
    };
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
