import { Injectable, NotFoundException } from '@nestjs/common';
import { BannerPlacement, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import {
  CreateBannerDto,
  UpdateBannerDto,
  ReorderBannersDto,
} from './dto/index.js';

@Injectable()
export class BannersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public: Fetch all active banners for frontend Hero Slider and promo sections.
   * Filters by active status, schedule validity (startDate/endDate), and sorted by position.
   */
  async getActiveBanners(placement?: BannerPlacement) {
    const now = new Date();

    const where: Prisma.BannerWhereInput = {
      isActive: true,
      ...(placement ? { placement } : {}),
      AND: [
        {
          OR: [{ startDate: null }, { startDate: { lte: now } }],
        },
        {
          OR: [{ endDate: null }, { endDate: { gte: now } }],
        },
      ],
    };

    return this.prisma.banner.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Admin: Create a new banner slide.
   */
  async create(createBannerDto: CreateBannerDto) {
    const { startDate, endDate, ...rest } = createBannerDto;

    return this.prisma.banner.create({
      data: {
        ...rest,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    });
  }

  /**
   * Admin: List all banners with pagination and filters.
   */
  async findAll(
    page = 1,
    limit = 20,
    placement?: BannerPlacement,
    isActive?: boolean,
    search?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.BannerWhereInput = {
      ...(placement ? { placement } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { subtitle: { contains: search, mode: 'insensitive' } },
              { badge: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, banners] = await Promise.all([
      this.prisma.banner.count({ where }),
      this.prisma.banner.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      }),
    ]);

    return {
      banners,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin/Public: Get a single banner by ID.
   */
  async findOne(id: string) {
    const banner = await this.prisma.banner.findUnique({
      where: { id },
    });

    if (!banner) {
      throw new NotFoundException(`Banner with ID "${id}" not found`);
    }

    return banner;
  }

  /**
   * Admin: Update an existing banner.
   */
  async update(id: string, updateBannerDto: UpdateBannerDto) {
    await this.findOne(id);

    const { startDate, endDate, ...rest } = updateBannerDto;

    return this.prisma.banner.update({
      where: { id },
      data: {
        ...rest,
        ...(startDate !== undefined
          ? { startDate: startDate ? new Date(startDate) : null }
          : {}),
        ...(endDate !== undefined
          ? { endDate: endDate ? new Date(endDate) : null }
          : {}),
      },
    });
  }

  /**
   * Admin: Quick toggle isActive status.
   */
  async toggleStatus(id: string) {
    const banner = await this.findOne(id);

    return this.prisma.banner.update({
      where: { id },
      data: {
        isActive: !banner.isActive,
      },
    });
  }

  /**
   * Admin: Bulk update sort positions for hero slider/banners.
   */
  async reorder(reorderBannersDto: ReorderBannersDto) {
    return this.prisma.$transaction(
      reorderBannersDto.items.map((item) =>
        this.prisma.banner.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );
  }

  /**
   * Admin: Delete banner.
   */
  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.banner.delete({
      where: { id },
    });
  }
}
