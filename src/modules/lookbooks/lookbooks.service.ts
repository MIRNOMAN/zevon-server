import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateLookbookDto, UpdateLookbookDto } from './dto/index.js';

@Injectable()
export class LookbooksService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Public Shoppable Lookbook Endpoints ──────────────────────

  /**
   * Public: Get all active lookbooks with populated hotspot product info.
   * Supports filtering by styling tag (Casual, Formal, Winter, etc.).
   */
  async getActiveLookbooks(tag?: string, page = 1, limit = 12) {
    const skip = (page - 1) * limit;

    const where: Prisma.LookbookWhereInput = {
      isActive: true,
      ...(tag ? { tags: { has: tag } } : {}),
    };

    const [total, lookbooks] = await Promise.all([
      this.prisma.lookbook.count({ where }),
      this.prisma.lookbook.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: {
          hotspots: {
            select: {
              id: true,
              coordinateX: true,
              coordinateY: true,
              product: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  basePrice: true,
                  discountPrice: true,
                  isFeatured: true,
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
      }),
    ]);

    return {
      lookbooks: lookbooks.map((l) => ({
        ...l,
        hotspots: l.hotspots.map((h) => ({
          id: h.id,
          xPercent: h.coordinateX,
          yPercent: h.coordinateY,
          product: h.product,
        })),
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
   * Public: Get single shoppable lookbook by slug with populated products.
   */
  async getLookbookBySlug(slug: string) {
    const lookbook = await this.prisma.lookbook.findUnique({
      where: { slug },
      include: {
        hotspots: {
          select: {
            id: true,
            coordinateX: true,
            coordinateY: true,
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

    if (!lookbook || !lookbook.isActive) {
      throw new NotFoundException(`Lookbook "${slug}" not found or inactive`);
    }

    return {
      ...lookbook,
      hotspots: lookbook.hotspots.map((h) => ({
        id: h.id,
        xPercent: h.coordinateX,
        yPercent: h.coordinateY,
        product: h.product,
      })),
    };
  }

  // ── Admin Lookbook CMS Operations ────────────────────────────

  /**
   * Admin: Create a new shoppable Lookbook with coordinate hotspot pins.
   */
  async create(createLookbookDto: CreateLookbookDto) {
    const { hotspots, slug, ...rest } = createLookbookDto;

    const generatedSlug = slug
      ? this.slugify(slug)
      : this.slugify(createLookbookDto.title);

    const existing = await this.prisma.lookbook.findUnique({
      where: { slug: generatedSlug },
    });

    if (existing) {
      throw new ConflictException(
        `Lookbook with slug "${generatedSlug}" already exists`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const lookbook = await tx.lookbook.create({
        data: {
          ...rest,
          slug: generatedSlug,
          tags: rest.tags ?? [],
          hotspots:
            hotspots && hotspots.length > 0
              ? {
                  create: hotspots.map((h) => ({
                    coordinateX: h.xPercent,
                    coordinateY: h.yPercent,
                    productId: h.productId,
                  })),
                }
              : undefined,
        },
        include: {
          hotspots: {
            include: {
              product: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  basePrice: true,
                  discountPrice: true,
                },
              },
            },
          },
        },
      });

      return {
        ...lookbook,
        hotspots: lookbook.hotspots.map((h) => ({
          id: h.id,
          xPercent: h.coordinateX,
          yPercent: h.coordinateY,
          product: h.product,
        })),
      };
    });
  }

  /**
   * Admin: List all lookbooks with pagination and filters.
   */
  async findAll(
    page = 1,
    limit = 20,
    tag?: string,
    isActive?: boolean,
    search?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.LookbookWhereInput = {
      ...(tag ? { tags: { has: tag } } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, lookbooks] = await Promise.all([
      this.prisma.lookbook.count({ where }),
      this.prisma.lookbook.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: {
          _count: {
            select: {
              hotspots: true,
            },
          },
          hotspots: {
            select: {
              id: true,
              coordinateX: true,
              coordinateY: true,
              productId: true,
            },
          },
        },
      }),
    ]);

    return {
      lookbooks: lookbooks.map((l) => ({
        ...l,
        hotspotCount: l._count.hotspots,
        hotspots: l.hotspots.map((h) => ({
          id: h.id,
          xPercent: h.coordinateX,
          yPercent: h.coordinateY,
          productId: h.productId,
        })),
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
   * Admin: Get single lookbook by ID with all hotspot pins and products.
   */
  async findOne(id: string) {
    const lookbook = await this.prisma.lookbook.findUnique({
      where: { id },
      include: {
        hotspots: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                slug: true,
                basePrice: true,
                discountPrice: true,
                images: {
                  select: {
                    url: true,
                    altText: true,
                    isPrimary: true,
                  },
                  orderBy: { isPrimary: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!lookbook) {
      throw new NotFoundException(`Lookbook with ID "${id}" not found`);
    }

    return {
      ...lookbook,
      hotspots: lookbook.hotspots.map((h) => ({
        id: h.id,
        xPercent: h.coordinateX,
        yPercent: h.coordinateY,
        product: h.product,
      })),
    };
  }

  /**
   * Admin: Update Lookbook and sync hotspot pins.
   */
  async update(id: string, updateLookbookDto: UpdateLookbookDto) {
    await this.findOne(id);

    const { hotspots, slug, ...rest } = updateLookbookDto;

    const dataToUpdate: Prisma.LookbookUpdateInput = {
      ...rest,
      ...(slug ? { slug: this.slugify(slug) } : {}),
    };

    return this.prisma.$transaction(async (tx) => {
      // If hotspots array provided in payload, replace existing pins
      if (hotspots !== undefined) {
        await tx.lookbookHotspot.deleteMany({
          where: { lookbookId: id },
        });

        if (hotspots.length > 0) {
          await tx.lookbookHotspot.createMany({
            data: hotspots.map((h) => ({
              lookbookId: id,
              coordinateX: h.xPercent,
              coordinateY: h.yPercent,
              productId: h.productId,
            })),
          });
        }
      }

      const updated = await tx.lookbook.update({
        where: { id },
        data: dataToUpdate,
        include: {
          hotspots: {
            include: {
              product: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  basePrice: true,
                  discountPrice: true,
                },
              },
            },
          },
        },
      });

      return {
        ...updated,
        hotspots: updated.hotspots.map((h) => ({
          id: h.id,
          xPercent: h.coordinateX,
          yPercent: h.coordinateY,
          product: h.product,
        })),
      };
    });
  }

  /**
   * Admin: Toggle lookbook visibility.
   */
  async toggleStatus(id: string) {
    const lookbook = await this.findOne(id);

    return this.prisma.lookbook.update({
      where: { id },
      data: {
        isActive: !lookbook.isActive,
      },
    });
  }

  /**
   * Admin: Delete lookbook.
   */
  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.lookbook.delete({
      where: { id },
    });
  }

  // ── Helper ───────────────────────────────────────────────────

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
