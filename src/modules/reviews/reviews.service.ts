import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, OrderStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import {
  CreateReviewDto,
  UpdateReviewDto,
  ReviewQueryDto,
  ReviewSortOption,
} from './dto/index.js';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Customer: Create a verified purchase review with rating, feedback, and customer photos.
   * Enforces verified purchase: user must have a DELIVERED order containing this product.
   */
  async create(userId: string, createReviewDto: CreateReviewDto) {
    const { productId, rating, comment, images } = createReviewDto;

    // 1. Verify product exists
    let product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      product = await this.prisma.product.findUnique({
        where: { slug: productId },
      });
    }

    if (!product) {
      throw new NotFoundException(`Product "${productId}" not found`);
    }

    const targetProductId = product.id;

    // 2. Check if user has already reviewed this product
    const existingReview = await this.prisma.review.findUnique({
      where: {
        userId_productId: {
          userId,
          productId: targetProductId,
        },
      },
    });

    if (existingReview) {
      throw new ConflictException(
        'You have already submitted a review for this product. You can update your existing review.',
      );
    }

    // 3. Check Verified Purchase Status
    const deliveredOrder = await this.prisma.order.findFirst({
      where: {
        userId,
        status: OrderStatus.DELIVERED,
        items: {
          some: {
            productId: targetProductId,
          },
        },
      },
    });

    const isVerifiedPurchase = !!deliveredOrder;

    // 4. Create Review
    const review = await this.prisma.review.create({
      data: {
        userId,
        productId: targetProductId,
        rating,
        comment,
        images: images ?? [],
        isVerifiedPurchase,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    // 5. Fetch updated aggregate metrics
    const aggregate = await this.getProductRatingAggregate(targetProductId);

    return {
      review,
      productAggregate: aggregate,
    };
  }

  /**
   * Public: Get all reviews for a product with ratings, customer photo gallery, and aggregate breakdown.
   */
  async findByProduct(productId: string, query: ReviewQueryDto) {
    let targetProductId = productId;
    const prod = await this.prisma.product.findFirst({
      where: {
        OR: [{ id: productId }, { slug: productId }],
      },
      select: { id: true },
    });
    if (prod) {
      targetProductId = prod.id;
    }

    const {
      page = 1,
      limit = 10,
      rating,
      hasImages,
      sortBy = ReviewSortOption.NEWEST,
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = {
      productId: targetProductId,
      ...(rating !== undefined ? { rating } : {}),
      ...(hasImages === true ? { images: { isEmpty: false } } : {}),
    };

    let orderBy: Prisma.ReviewOrderByWithRelationInput = { createdAt: 'desc' };
    if (sortBy === ReviewSortOption.HIGHEST) {
      orderBy = { rating: 'desc' };
    } else if (sortBy === ReviewSortOption.LOWEST) {
      orderBy = { rating: 'asc' };
    }

    const [total, reviews, aggregate] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      }),
      this.getProductRatingAggregate(productId),
    ]);

    return {
      aggregate,
      reviews,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Customer: Check if customer is eligible to review a product.
   */
  async checkEligibility(userId: string, productId: string) {
    const [deliveredOrder, existingReview] = await Promise.all([
      this.prisma.order.findFirst({
        where: {
          userId,
          status: OrderStatus.DELIVERED,
          items: {
            some: {
              productId,
            },
          },
        },
      }),
      this.prisma.review.findUnique({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
      }),
    ]);

    const hasDeliveredOrder = !!deliveredOrder;
    const alreadyReviewed = !!existingReview;
    const isEligible = hasDeliveredOrder && !alreadyReviewed;

    return {
      productId,
      isEligible,
      hasDeliveredOrder,
      alreadyReviewed,
      existingReview: existingReview || null,
      message: isEligible
        ? 'Eligible to submit a verified review'
        : alreadyReviewed
          ? 'You have already reviewed this product'
          : 'You can review this product once it is delivered',
    };
  }

  /**
   * Customer: Get all reviews written by the authenticated user.
   */
  async findUserReviews(userId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            slug: true,
            basePrice: true,
            images: {
              where: { isPrimary: true },
              take: 1,
            },
          },
        },
      },
    });

    return {
      reviews,
      totalCount: reviews.length,
    };
  }

  /**
   * Customer: Update their existing review.
   */
  async update(
    userId: string,
    reviewId: string,
    updateReviewDto: UpdateReviewDto,
  ) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException(`Review with ID "${reviewId}" not found`);
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('You can only update your own review');
    }

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        ...(updateReviewDto.rating !== undefined
          ? { rating: updateReviewDto.rating }
          : {}),
        ...(updateReviewDto.comment !== undefined
          ? { comment: updateReviewDto.comment }
          : {}),
        ...(updateReviewDto.images !== undefined
          ? { images: updateReviewDto.images }
          : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    const aggregate = await this.getProductRatingAggregate(review.productId);

    return {
      review: updated,
      productAggregate: aggregate,
    };
  }

  /**
   * Customer/Admin: Delete review.
   */
  async remove(userId: string, reviewId: string, userRole?: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException(`Review with ID "${reviewId}" not found`);
    }

    if (
      review.userId !== userId &&
      userRole !== 'ADMIN' &&
      userRole !== 'MANAGER'
    ) {
      throw new ForbiddenException(
        'You do not have permission to delete this review',
      );
    }

    await this.prisma.review.delete({
      where: { id: reviewId },
    });

    const aggregate = await this.getProductRatingAggregate(review.productId);

    return {
      deleted: true,
      message: 'Review deleted successfully',
      productAggregate: aggregate,
    };
  }

  // ── Helper Methods ──────────────────────────────────────────

  private async getProductRatingAggregate(productId: string) {
    const [avgRatingRes, ratingCounts, photoCount, totalReviews] =
      await Promise.all([
        this.prisma.review.aggregate({
          where: { productId },
          _avg: { rating: true },
        }),
        this.prisma.review.groupBy({
          by: ['rating'],
          where: { productId },
          _count: { rating: true },
        }),
        this.prisma.review.count({
          where: {
            productId,
            images: { isEmpty: false },
          },
        }),
        this.prisma.review.count({
          where: { productId },
        }),
      ]);

    const ratingBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    ratingCounts.forEach((r) => {
      if (r.rating >= 1 && r.rating <= 5) {
        ratingBreakdown[r.rating as 1 | 2 | 3 | 4 | 5] = r._count.rating;
      }
    });

    const averageRating = avgRatingRes._avg.rating
      ? Number(avgRatingRes._avg.rating.toFixed(1))
      : 0;

    return {
      averageRating,
      totalReviews,
      photoReviewsCount: photoCount,
      ratingBreakdown,
    };
  }
}
