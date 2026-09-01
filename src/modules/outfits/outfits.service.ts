import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import {
  CreateOutfitDto,
  UpdateOutfitDto,
  CalculateOutfitTotalDto,
  OutfitCheckoutBundleDto,
  OutfitQueryDto,
} from './dto/index.js';

@Injectable()
export class OutfitsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public: List Curated & Trending Outfits with filters (occasion, gender, tags, search).
   */
  async findAll(query: OutfitQueryDto) {
    const {
      page = 1,
      limit = 12,
      occasion,
      gender,
      isCurated = true,
      search,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.OutfitWhereInput = {
      isActive: true,
      ...(isCurated !== undefined && { isCurated }),
      ...(occasion && {
        occasion: { contains: occasion, mode: 'insensitive' },
      }),
      ...(gender && {
        gender: { equals: gender, mode: 'insensitive' },
      }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { tags: { hasSome: [search] } },
        ],
      }),
    };

    const [total, outfits] = await Promise.all([
      this.prisma.outfit.count({ where }),
      this.prisma.outfit.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ viewsCount: 'desc' }, { createdAt: 'desc' }],
        include: {
          items: {
            orderBy: [{ zIndex: 'asc' }, { createdAt: 'asc' }],
            include: {
              product: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  basePrice: true,
                  discountPrice: true,
                  images: {
                    where: { isPrimary: true },
                    select: { url: true },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const formatted = outfits.map((outfit) => {
      const itemsSubtotal = outfit.items.reduce((sum, item) => {
        const price = item.product.discountPrice
          ? Number(item.product.discountPrice)
          : Number(item.product.basePrice);
        return sum + price;
      }, 0);

      const discountAmount =
        (itemsSubtotal * (outfit.bundleDiscountPercent || 0)) / 100;
      const bundlePrice = Math.max(0, itemsSubtotal - discountAmount);

      return {
        id: outfit.id,
        title: outfit.title,
        slug: outfit.slug,
        description: outfit.description,
        coverImageUrl:
          outfit.coverImageUrl ||
          outfit.items[0]?.product.images[0]?.url ||
          null,
        occasion: outfit.occasion,
        gender: outfit.gender,
        tags: outfit.tags,
        bundleDiscountPercent: outfit.bundleDiscountPercent,
        isCurated: outfit.isCurated,
        viewsCount: outfit.viewsCount,
        itemCount: outfit.items.length,
        itemsSubtotal: Number(itemsSubtotal.toFixed(2)),
        bundlePrice: Number(bundlePrice.toFixed(2)),
        savingsAmount: Number(discountAmount.toFixed(2)),
        slots: outfit.items.map((item) => ({
          slot: item.slot,
          productId: item.productId,
          productTitle: item.product.title,
          productSlug: item.product.slug,
          imageUrl: item.product.images[0]?.url || null,
          price: item.product.discountPrice
            ? Number(item.product.discountPrice)
            : Number(item.product.basePrice),
          positionX: item.positionX,
          positionY: item.positionY,
        })),
      };
    });

    return {
      data: formatted,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Public: Get complete Outfit Builder Canvas payload by ID or SEO slug.
   * Includes all slots (Top, Bottom, Footwear, etc.) with available variants & live stock.
   */
  async findOne(idOrSlug: string) {
    const outfit = await this.prisma.outfit.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        isActive: true,
      },
      include: {
        items: {
          orderBy: [{ zIndex: 'asc' }, { createdAt: 'asc' }],
          include: {
            product: {
              include: {
                category: {
                  select: { id: true, name: true, slug: true },
                },
                images: {
                  orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
                },
                variants: {
                  select: {
                    id: true,
                    sku: true,
                    color: true,
                    colorCode: true,
                    size: true,
                    stock: true,
                    extraPrice: true,
                    imageUrl: true,
                  },
                  orderBy: [{ color: 'asc' }, { size: 'asc' }],
                },
              },
            },
          },
        },
      },
    });

    if (!outfit) {
      throw new NotFoundException(`Outfit "${idOrSlug}" not found`);
    }

    // Increment view count asynchronously
    this.prisma.outfit
      .update({
        where: { id: outfit.id },
        data: { viewsCount: { increment: 1 } },
      })
      .catch(() => {});

    // Compute live bundle pricing using default or first available variants
    let rawSubtotal = 0;
    const canvasSlots = outfit.items.map((item) => {
      const { product } = item;
      const basePrice = Number(product.basePrice);
      const discountPrice = product.discountPrice
        ? Number(product.discountPrice)
        : null;
      const effectivePrice = discountPrice ?? basePrice;

      rawSubtotal += effectivePrice;

      const defaultVar =
        product.variants.find((v) => v.id === item.defaultVariantId) ||
        product.variants.find((v) => v.stock > 0) ||
        product.variants[0];

      return {
        slotId: item.id,
        slot: item.slot,
        positionX: item.positionX,
        positionY: item.positionY,
        zIndex: item.zIndex,
        scale: item.scale,
        product: {
          id: product.id,
          title: product.title,
          slug: product.slug,
          category: product.category,
          basePrice,
          discountPrice,
          effectivePrice,
          hoverVideoUrl: product.hoverVideoUrl,
          fabricWeave: product.fabricWeave,
          primaryImage: product.images[0]?.url ?? null,
          allImages: product.images.map((img) => img.url),
          defaultVariant: defaultVar
            ? {
                id: defaultVar.id,
                sku: defaultVar.sku,
                color: defaultVar.color,
                colorCode: defaultVar.colorCode,
                size: defaultVar.size,
                stock: defaultVar.stock,
                inStock: defaultVar.stock > 0,
                imageUrl: defaultVar.imageUrl || product.images[0]?.url || null,
              }
            : null,
          availableVariants: product.variants.map((v) => ({
            id: v.id,
            sku: v.sku,
            color: v.color,
            colorCode: v.colorCode,
            size: v.size,
            stock: v.stock,
            inStock: v.stock > 0,
            extraPrice: Number(v.extraPrice),
            imageUrl: v.imageUrl || product.images[0]?.url || null,
          })),
        },
      };
    });

    const bundleDiscountPercent = outfit.bundleDiscountPercent || 10;
    const discountAmount = (rawSubtotal * bundleDiscountPercent) / 100;
    const bundleTotalPrice = Math.max(0, rawSubtotal - discountAmount);

    return {
      id: outfit.id,
      title: outfit.title,
      slug: outfit.slug,
      description: outfit.description,
      coverImageUrl: outfit.coverImageUrl,
      occasion: outfit.occasion,
      gender: outfit.gender,
      tags: outfit.tags,
      bundleDiscountPercent,
      isCurated: outfit.isCurated,
      viewsCount: outfit.viewsCount,
      pricing: {
        individualSubtotal: Number(rawSubtotal.toFixed(2)),
        bundleDiscountPercent,
        bundleSavings: Number(discountAmount.toFixed(2)),
        bundleTotalPrice: Number(bundleTotalPrice.toFixed(2)),
      },
      canvasSlots,
    };
  }

  /**
   * Public: Real-time price and stock calculator for any mix & match combination on canvas.
   * Customer picks arbitrary Top, Bottom, Footwear variants -> Live bundle discount + total calculated.
   */
  async calculateBundleTotal(dto: CalculateOutfitTotalDto) {
    const { variantIds, bundleDiscountPercent = 10 } = dto;

    if (!variantIds || variantIds.length === 0) {
      throw new BadRequestException('At least one variant must be provided');
    }

    const uniqueVariantIds = Array.from(new Set(variantIds));
    const variants = await this.prisma.productVariant.findMany({
      where: {
        id: { in: uniqueVariantIds },
      },
      include: {
        product: {
          include: {
            category: { select: { id: true, name: true, slug: true } },
            images: { where: { isPrimary: true }, take: 1 },
          },
        },
      },
    });

    if (variants.length !== uniqueVariantIds.length) {
      throw new NotFoundException(
        'One or more selected clothing variants could not be found',
      );
    }

    let subtotal = 0;
    let allInStock = true;

    const items = variants.map((v) => {
      const base = Number(v.product.basePrice);
      const discount = v.product.discountPrice
        ? Number(v.product.discountPrice)
        : null;
      const extra = Number(v.extraPrice);
      const unitPrice = (discount ?? base) + extra;

      subtotal += unitPrice;
      const inStock = v.stock > 0;
      if (!inStock) allInStock = false;

      return {
        variantId: v.id,
        productId: v.product.id,
        title: v.product.title,
        slug: v.product.slug,
        category: v.product.category.name,
        color: v.color,
        colorCode: v.colorCode,
        size: v.size,
        sku: v.sku,
        unitPrice: Number(unitPrice.toFixed(2)),
        stock: v.stock,
        inStock,
        imageUrl: v.imageUrl || v.product.images[0]?.url || null,
      };
    });

    // Multi-item bundle discount: 2 items = 5%, 3 items = 10%, 4+ items = 15% (or custom bundleDiscountPercent)
    let appliedDiscountPercent = bundleDiscountPercent;
    if (!dto.bundleDiscountPercent) {
      if (items.length >= 4) appliedDiscountPercent = 15;
      else if (items.length === 3) appliedDiscountPercent = 10;
      else if (items.length === 2) appliedDiscountPercent = 5;
      else appliedDiscountPercent = 0;
    }

    const discountAmount = (subtotal * appliedDiscountPercent) / 100;
    const bundleTotalPrice = Math.max(0, subtotal - discountAmount);

    return {
      itemCount: items.length,
      subtotal: Number(subtotal.toFixed(2)),
      bundleDiscountPercent: appliedDiscountPercent,
      bundleSavings: Number(discountAmount.toFixed(2)),
      bundleTotalPrice: Number(bundleTotalPrice.toFixed(2)),
      canCheckout: allInStock,
      items,
    };
  }

  /**
   * Customer: 1-Click Checkout / Add Complete Outfit to Cart atomically.
   */
  async addBundleToCart(userId: string, dto: OutfitCheckoutBundleDto) {
    const { items } = dto;

    if (!items || items.length === 0) {
      throw new BadRequestException('Outfit items cannot be empty');
    }

    // 1. Validate variants & check stock
    const variantIds = items.map((i) => i.productVariantId);
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: true },
    });

    if (variants.length !== variantIds.length) {
      throw new NotFoundException('One or more product variants do not exist');
    }

    const variantMap = new Map(variants.map((v) => [v.id, v]));

    for (const item of items) {
      const v = variantMap.get(item.productVariantId);
      if (!v || !v.product.isPublished) {
        throw new BadRequestException(`Product is unpublished or unavailable`);
      }
      if (v.stock < (item.quantity || 1)) {
        throw new BadRequestException(
          `Insufficient stock for "${v.product.title}" (${v.color}, ${v.size}). Only ${v.stock} in stock.`,
        );
      }
    }

    // 2. Add all items to user cart inside an atomic transaction
    return this.prisma.$transaction(async (tx) => {
      // Find or create cart
      let cart = await tx.cart.findUnique({
        where: { userId },
      });

      if (!cart) {
        cart = await tx.cart.create({
          data: { userId },
        });
      }

      for (const item of items) {
        const qty = item.quantity || 1;
        const existingCartItem = await tx.cartItem.findUnique({
          where: {
            cartId_productVariantId: {
              cartId: cart.id,
              productVariantId: item.productVariantId,
            },
          },
        });

        if (existingCartItem) {
          await tx.cartItem.update({
            where: { id: existingCartItem.id },
            data: { quantity: existingCartItem.quantity + qty },
          });
        } else {
          await tx.cartItem.create({
            data: {
              cartId: cart.id,
              productVariantId: item.productVariantId,
              quantity: qty,
            },
          });
        }
      }

      const updatedCart = await tx.cart.findUnique({
        where: { id: cart.id },
        include: {
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

      return {
        message: `Added ${items.length} outfit items to your cart successfully`,
        cartId: cart.id,
        totalItemsCount: updatedCart?.items.reduce(
          (sum, i) => sum + i.quantity,
          0,
        ),
      };
    });
  }

  /**
   * Customer: Save personal Mix & Match Outfit creation to their account.
   */
  async saveUserOutfit(userId: string, dto: CreateOutfitDto) {
    const slug = `${this.slugify(dto.title)}-${Date.now().toString(36)}`;

    // Verify products exist
    const productIds = dto.items.map((i) => i.productId);
    const existingCount = await this.prisma.product.count({
      where: { id: { in: productIds } },
    });

    if (existingCount !== productIds.length) {
      throw new BadRequestException(
        'One or more selected products do not exist',
      );
    }

    return this.prisma.outfit.create({
      data: {
        title: dto.title,
        slug,
        description: dto.description,
        coverImageUrl: dto.coverImageUrl,
        occasion: dto.occasion || 'Custom Mix',
        gender: dto.gender || 'UNISEX',
        tags: dto.tags || ['Custom Mix', 'My Creation'],
        bundleDiscountPercent: dto.bundleDiscountPercent || 10,
        isCurated: false,
        userId,
        items: {
          create: dto.items.map((item) => ({
            productId: item.productId,
            defaultVariantId: item.defaultVariantId,
            slot: item.slot,
            positionX: item.positionX ?? 50.0,
            positionY: item.positionY ?? 50.0,
            zIndex: item.zIndex ?? 1,
            scale: item.scale ?? 1.0,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, title: true, slug: true, basePrice: true },
            },
          },
        },
      },
    });
  }

  /**
   * Customer: Get all mix & match outfits saved by the logged-in user.
   */
  async getUserOutfits(userId: string) {
    return this.prisma.outfit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                slug: true,
                basePrice: true,
                images: { where: { isPrimary: true }, take: 1 },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Admin / Stylist: Create curated brand outfit with canvas positions.
   */
  async createCurated(dto: CreateOutfitDto) {
    const slug = dto.slug ? this.slugify(dto.slug) : this.slugify(dto.title);

    const existing = await this.prisma.outfit.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new ConflictException(
        `Outfit with slug "${slug}" already exists. Please choose a different slug/title.`,
      );
    }

    return this.prisma.outfit.create({
      data: {
        title: dto.title,
        slug,
        description: dto.description,
        coverImageUrl: dto.coverImageUrl,
        occasion: dto.occasion,
        gender: dto.gender,
        tags: dto.tags || [],
        bundleDiscountPercent: dto.bundleDiscountPercent || 10,
        isCurated: dto.isCurated ?? true,
        items: {
          create: dto.items.map((item) => ({
            productId: item.productId,
            defaultVariantId: item.defaultVariantId,
            slot: item.slot,
            positionX: item.positionX ?? 50.0,
            positionY: item.positionY ?? 50.0,
            zIndex: item.zIndex ?? 1,
            scale: item.scale ?? 1.0,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, title: true, slug: true, basePrice: true },
            },
          },
        },
      },
    });
  }

  /**
   * Admin: Update curated outfit layout or details.
   */
  async update(id: string, dto: UpdateOutfitDto) {
    const outfit = await this.prisma.outfit.findUnique({
      where: { id },
    });

    if (!outfit) {
      throw new NotFoundException(`Outfit with ID "${id}" not found`);
    }

    const { items, ...rest } = dto;

    return this.prisma.$transaction(async (tx) => {
      if (items && items.length > 0) {
        await tx.outfitItem.deleteMany({
          where: { outfitId: id },
        });

        await tx.outfitItem.createMany({
          data: items.map((item) => ({
            outfitId: id,
            productId: item.productId,
            defaultVariantId: item.defaultVariantId,
            slot: item.slot,
            positionX: item.positionX ?? 50.0,
            positionY: item.positionY ?? 50.0,
            zIndex: item.zIndex ?? 1,
            scale: item.scale ?? 1.0,
          })),
        });
      }

      return tx.outfit.update({
        where: { id },
        data: {
          ...rest,
          ...(rest.slug && { slug: this.slugify(rest.slug) }),
        },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, title: true, slug: true, basePrice: true },
              },
            },
          },
        },
      });
    });
  }

  /**
   * Admin: Delete outfit.
   */
  async remove(id: string) {
    const outfit = await this.prisma.outfit.findUnique({
      where: { id },
    });

    if (!outfit) {
      throw new NotFoundException(`Outfit with ID "${id}" not found`);
    }

    await this.prisma.outfit.delete({
      where: { id },
    });

    return { message: 'Outfit deleted successfully', id };
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/['’]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
