import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class WishlistsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Customer: Toggle add/remove a product in wishlist.
   */
  async toggle(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${productId}" not found`);
    }

    const existing = await this.prisma.wishlist.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    if (existing) {
      await this.prisma.wishlist.delete({
        where: { id: existing.id },
      });

      return {
        productId,
        inWishlist: false,
        action: 'REMOVED',
        message: 'Product removed from your wishlist',
      };
    }

    await this.prisma.wishlist.create({
      data: {
        userId,
        productId,
      },
    });

    return {
      productId,
      inWishlist: true,
      action: 'ADDED',
      message: 'Product saved to your wishlist',
    };
  }

  /**
   * Customer: Get all saved wishlist items with live product cards & stock status.
   */
  async findAll(userId: string) {
    const items = await this.prisma.wishlist.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          include: {
            category: {
              select: { id: true, name: true, slug: true },
            },
            images: {
              orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
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
                extraPrice: true,
              },
            },
          },
        },
      },
    });

    const formatted = items.map((item) => {
      const p = item.product;
      const totalStock = p.variants.reduce((acc, v) => acc + v.stock, 0);
      const availableSizes = Array.from(new Set(p.variants.map((v) => v.size)));
      const availableColors = Array.from(
        new Set(
          p.variants.map((v) =>
            JSON.stringify({ color: v.color, colorCode: v.colorCode }),
          ),
        ),
      ).map((str) => JSON.parse(str) as { color: string; colorCode: string });

      return {
        wishlistId: item.id,
        addedAt: item.createdAt,
        product: {
          id: p.id,
          title: p.title,
          slug: p.slug,
          basePrice: p.basePrice,
          discountPrice: p.discountPrice,
          isPublished: p.isPublished,
          category: p.category,
          primaryImage:
            p.images.find((img) => img.isPrimary) || p.images[0] || null,
          availableSizes,
          availableColors,
          totalStock,
          inStock: totalStock > 0,
        },
      };
    });

    return {
      items: formatted,
      totalCount: formatted.length,
    };
  }

  /**
   * Customer: Quick check if a product is in the user's wishlist.
   */
  async check(userId: string, productId: string) {
    const existing = await this.prisma.wishlist.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    return {
      productId,
      inWishlist: !!existing,
    };
  }

  /**
   * Customer: Clear all items from wishlist.
   */
  async clear(userId: string) {
    const result = await this.prisma.wishlist.deleteMany({
      where: { userId },
    });

    return {
      clearedCount: result.count,
      message: 'Wishlist cleared successfully',
    };
  }
}
