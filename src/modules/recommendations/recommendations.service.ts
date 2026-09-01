import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { TrackViewDto } from './dto/index.js';

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── 1. Track Product View (Browsing History) ────────────────────────────

  /**
   * Records a product view event for authenticated user or anonymous guest session.
   */
  async trackView(dto: TrackViewDto, userId?: string) {
    const { productId, sessionId } = dto;

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, isPublished: true },
    });

    if (!product || !product.isPublished) {
      throw new NotFoundException('Product not found or is currently unpublished');
    }

    const view = await this.prisma.productView.create({
      data: {
        productId,
        userId: userId || null,
        sessionId: sessionId || null,
      },
    });

    return {
      recorded: true,
      viewId: view.id,
      viewedAt: view.viewedAt,
    };
  }

  // ── 2. Get Recently Viewed Carousel ─────────────────────────────────────

  /**
   * Retrieves deduplicated recently viewed clothing items for user/session.
   */
  async getRecentlyViewed(params: {
    userId?: string;
    sessionId?: string;
    limit?: number;
  }) {
    const { userId, sessionId, limit = 10 } = params;

    if (!userId && !sessionId) {
      return { total: 0, items: [] };
    }

    const views = await this.prisma.productView.findMany({
      where: {
        OR: [
          ...(userId ? [{ userId }] : []),
          ...(sessionId ? [{ sessionId }] : []),
        ],
        product: { isPublished: true },
      },
      orderBy: { viewedAt: 'desc' },
      take: limit * 3, // Overfetch to deduplicate
      include: {
        product: {
          include: {
            category: { select: { id: true, name: true, slug: true } },
            images: { where: { isPrimary: true }, take: 1 },
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

    // Deduplicate unique products while preserving newest view order
    const seenProductIds = new Set<string>();
    const deduplicatedProducts: Array<Record<string, unknown>> = [];

    for (const v of views) {
      if (!seenProductIds.has(v.productId)) {
        seenProductIds.add(v.productId);
        const p = v.product;
        deduplicatedProducts.push({
          id: p.id,
          title: p.title,
          slug: p.slug,
          basePrice: Number(p.basePrice),
          discountPrice: p.discountPrice ? Number(p.discountPrice) : null,
          category: p.category,
          primaryImage: p.images[0]?.url || null,
          variantsCount: p.variants.length,
          availableSizes: Array.from(new Set(p.variants.map((varItem) => varItem.size))),
          availableColors: Array.from(new Set(p.variants.map((varItem) => varItem.color))),
          inStock: p.variants.some((varItem) => varItem.stock > 0),
          lastViewedAt: v.viewedAt,
        });

        if (deduplicatedProducts.length >= limit) break;
      }
    }

    return {
      total: deduplicatedProducts.length,
      items: deduplicatedProducts,
    };
  }

  // ── 3. "You May Also Like" Smart Cross-Sell Recommendations ────────────

  /**
   * Smart similarity recommendation algorithm:
   * 1. Category match (primary anchor)
   * 2. Tag / keyword overlaps
   * 3. Price similarity bracket (+-35%)
   * 4. Top-rated & bestseller fallback
   */
  async getYouMayAlsoLike(productId: string, limit = 8) {
    const targetProduct = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { category: true },
    });

    if (!targetProduct) {
      throw new NotFoundException(`Product with ID "${productId}" was not found`);
    }

    const targetPrice = Number(targetProduct.basePrice);
    const minPrice = targetPrice * 0.65;
    const maxPrice = targetPrice * 1.35;

    // 1. Fetch potential similar products in same category or matching tags
    const candidates = await this.prisma.product.findMany({
      where: {
        id: { not: productId },
        isPublished: true,
        OR: [
          { categoryId: targetProduct.categoryId },
          { tags: { hasSome: targetProduct.tags } },
          {
            basePrice: {
              gte: new Prisma.Decimal(minPrice),
              lte: new Prisma.Decimal(maxPrice),
            },
          },
        ],
      },
      take: 25,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: { where: { isPrimary: true }, take: 1 },
        variants: {
          select: {
            id: true,
            sku: true,
            size: true,
            color: true,
            stock: true,
            extraPrice: true,
          },
        },
        reviews: { select: { rating: true } },
      },
    });

    // 2. Score each candidate
    const scoredCandidates = candidates.map((p) => {
      let score = 0;

      // Category match (weight: 40)
      if (p.categoryId === targetProduct.categoryId) {
        score += 40;
      }

      // Tag overlaps (weight: up to 30)
      const matchingTags = p.tags.filter((t) => targetProduct.tags.includes(t));
      score += Math.min(matchingTags.length * 10, 30);

      // Price bracket similarity (weight: 20)
      const price = Number(p.basePrice);
      if (price >= minPrice && price <= maxPrice) {
        score += 20;
      }

      // Review ratings boost (weight: 10)
      if (p.reviews.length > 0) {
        const avgRating =
          p.reviews.reduce((acc, r) => acc + r.rating, 0) / p.reviews.length;
        score += avgRating * 2;
      }

      return {
        product: p,
        score,
      };
    });

    // Sort by score descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    let recommendations = scoredCandidates.slice(0, limit).map((c) => this.formatProductCard(c.product));

    // 3. Fallback: If not enough matches, fill up with featured/popular products
    if (recommendations.length < limit) {
      const remainingLimit = limit - recommendations.length;
      const existingIds = new Set([productId, ...recommendations.map((r) => r.id)]);

      const fallbackProducts = await this.prisma.product.findMany({
        where: {
          id: { notIn: Array.from(existingIds) },
          isPublished: true,
        },
        take: remainingLimit,
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        include: {
          category: { select: { id: true, name: true, slug: true } },
          images: { where: { isPrimary: true }, take: 1 },
          variants: {
            select: { id: true, sku: true, size: true, color: true, stock: true },
          },
        },
      });

      recommendations = [
        ...recommendations,
        ...fallbackProducts
          .filter((p) => !existingIds.has(p.id))
          .map((p) => this.formatProductCard(p)),
      ];
    }

    return {
      targetProduct: {
        id: targetProduct.id,
        title: targetProduct.title,
        category: targetProduct.category.name,
      },
      total: recommendations.length,
      recommendations,
    };
  }

  // ── 4. Trending & Best-Selling Recommendations Carousel ────────────────

  /**
   * Returns trending clothing products based on recent orders and views.
   */
  async getTrending(limit = 8) {
    const products = await this.prisma.product.findMany({
      where: { isPublished: true },
      take: limit,
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: { where: { isPrimary: true }, take: 1 },
        variants: {
          select: {
            id: true,
            sku: true,
            size: true,
            color: true,
            stock: true,
          },
        },
        _count: { select: { reviews: true, orderItems: true } },
      },
    });

    return {
      total: products.length,
      items: products.map((p) => ({
        ...this.formatProductCard(p),
        reviewsCount: p._count?.reviews || 0,
        ordersCount: p._count?.orderItems || 0,
      })),
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private formatProductCard(p: {
    id: string;
    title: string;
    slug: string;
    basePrice: Prisma.Decimal;
    discountPrice?: Prisma.Decimal | null;
    category: { id: string; name: string; slug: string };
    images: Array<{ url: string }>;
    variants: Array<{ size: string; color: string; stock: number }>;
  }) {
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      basePrice: Number(p.basePrice),
      discountPrice: p.discountPrice ? Number(p.discountPrice) : null,
      category: p.category,
      primaryImage: p.images[0]?.url || null,
      availableSizes: Array.from(new Set(p.variants.map((v) => v.size))),
      availableColors: Array.from(new Set(p.variants.map((v) => v.color))),
      inStock: p.variants.some((v) => v.stock > 0),
    };
  }
}
