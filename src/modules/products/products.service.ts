import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import {
  CreateProductDto,
  UpdateProductDto,
  ProductQueryDto,
  ProductSortOption,
  SizeRecommendationDto,
  FitPreference,
  GenderPreference,
} from './dto/index.js';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Admin: Multi-Variant Product Creation with Media Gallery inside an atomic Prisma Transaction.
   * Inserts base product specs, fabric & wash details, gallery media, and all clothing SKU variants.
   */
  async create(createProductDto: CreateProductDto) {
    const { variants, images, categoryId, slug, ...rest } = createProductDto;

    // 1. Verify Category exists
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException(`Category with ID "${categoryId}" not found`);
    }

    // 2. Validate Variants array
    if (!variants || variants.length === 0) {
      throw new BadRequestException(
        'Product must contain at least one clothing variant (SKU, Color, Size, Stock)',
      );
    }

    // 3. Check for duplicate SKUs in the incoming request
    const incomingSkus = variants.map((v) => v.sku.toUpperCase().trim());
    const uniqueIncomingSkus = new Set(incomingSkus);
    if (uniqueIncomingSkus.size !== incomingSkus.length) {
      throw new BadRequestException(
        'Duplicate SKU detected in the incoming variant payload',
      );
    }

    // 4. Check for duplicate [color, size] combinations in incoming payload
    const colorSizeKeys = variants.map(
      (v) => `${v.color.toLowerCase().trim()}_${v.size.toUpperCase().trim()}`,
    );
    if (new Set(colorSizeKeys).size !== colorSizeKeys.length) {
      throw new BadRequestException(
        'Duplicate color and size combination detected in variants payload',
      );
    }

    // 5. Verify SKUs do not already exist in database
    const existingSkuRecords = await this.prisma.productVariant.findMany({
      where: {
        sku: { in: incomingSkus },
      },
      select: { sku: true },
    });

    if (existingSkuRecords.length > 0) {
      const existingList = existingSkuRecords.map((r) => r.sku).join(', ');
      throw new ConflictException(
        `The following SKU(s) already exist in the database: ${existingList}`,
      );
    }

    // 6. Generate & Validate Unique SEO Slug
    const generatedSlug = slug
      ? this.slugify(slug)
      : this.slugify(createProductDto.title);

    const existingSlug = await this.prisma.product.findUnique({
      where: { slug: generatedSlug },
    });

    if (existingSlug) {
      throw new ConflictException(
        `Product with slug "${generatedSlug}" already exists. Please customize the slug.`,
      );
    }

    // 7. Ensure at least one image is primary if images provided
    let processedImages = images ?? [];
    if (processedImages.length > 0) {
      const hasPrimary = processedImages.some((img) => img.isPrimary === true);
      if (!hasPrimary) {
        processedImages = processedImages.map((img, idx) => ({
          ...img,
          isPrimary: idx === 0,
        }));
      }
    }

    // 8. Execute Atomic Database Transaction
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...rest,
          slug: generatedSlug,
          categoryId,
          tags: rest.tags ?? [],
          images:
            processedImages.length > 0
              ? {
                  create: processedImages.map((img, idx) => ({
                    url: img.url,
                    altText:
                      img.altText ||
                      `${createProductDto.title} - View ${idx + 1}`,
                    isPrimary: img.isPrimary ?? idx === 0,
                    sortOrder: img.sortOrder ?? idx,
                  })),
                }
              : undefined,
          variants: {
            create: variants.map((v) => ({
              sku: v.sku.toUpperCase().trim(),
              color: v.color.trim(),
              colorCode: v.colorCode.trim(),
              size: v.size.toUpperCase().trim(),
              stock: v.stock,
              extraPrice: v.extraPrice ?? 0,
              imageUrl: v.imageUrl,
            })),
          },
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          images: {
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          },
          variants: {
            orderBy: [{ color: 'asc' }, { size: 'asc' }],
          },
        },
      });

      const totalStock = product.variants.reduce((acc, v) => acc + v.stock, 0);

      return {
        ...product,
        totalStock,
        inStock: totalStock > 0,
      };
    });
  }

  /**
   * Public & Admin: Advanced Product Catalog Query Engine.
   * Dynamic Multi-Filtering: categorySlug (hierarchical), price range, colors, sizes, inStock availability.
   * Full-Text Search across titles, fabric specs, tags, and SKUs.
   * Multi-Sorting: price-asc, price-desc, newest, rating, popular.
   * Paginated with Facet Metadata for frontend filter sidebars.
   */
  async findAll(query: ProductQueryDto) {
    const {
      page = 1,
      limit = 20,
      search,
      categorySlug,
      categoryId,
      gender,
      season,
      sizes,
      size,
      colors,
      color,
      minPrice,
      maxPrice,
      inStock,
      isFeatured,
      isPublished = true,
      sortBy = ProductSortOption.NEWEST,
    } = query;

    const skip = (page - 1) * limit;

    // 1. Resolve Hierarchical Category IDs if categorySlug or categoryId is given
    let targetCategoryIds: string[] | undefined;
    if (categorySlug) {
      targetCategoryIds =
        await this.getCategoryAndChildrenIdsBySlug(categorySlug);
      if (targetCategoryIds.length === 0) {
        return this.emptyQueryResult(page, limit);
      }
    } else if (categoryId) {
      targetCategoryIds = [categoryId];
    }

    // 2. Parse Size & Color filters
    const targetSizes = (sizes && sizes.length > 0 ? sizes : size ? [size] : [])
      .map((s) => s.toUpperCase().trim())
      .filter(Boolean);

    const targetColors = (
      colors && colors.length > 0 ? colors : color ? [color] : []
    )
      .map((c) => c.trim())
      .filter(Boolean);

    // 3. Construct Prisma Where Clause
    const where: Prisma.ProductWhereInput = {
      ...(isPublished !== undefined ? { isPublished } : {}),
      ...(isFeatured !== undefined ? { isFeatured } : {}),
      ...(targetCategoryIds ? { categoryId: { in: targetCategoryIds } } : {}),
      ...(gender ? { gender: { equals: gender, mode: 'insensitive' } } : {}),
      ...(season ? { season: { equals: season, mode: 'insensitive' } } : {}),
      ...(minPrice !== undefined || maxPrice !== undefined
        ? {
            basePrice: {
              ...(minPrice !== undefined ? { gte: minPrice } : {}),
              ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { details: { contains: search, mode: 'insensitive' } },
              { fabricSpecs: { contains: search, mode: 'insensitive' } },
              { tags: { has: search } },
              {
                variants: {
                  some: {
                    OR: [
                      { sku: { contains: search, mode: 'insensitive' } },
                      { color: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
      ...(targetSizes.length > 0 || targetColors.length > 0 || inStock === true
        ? {
            variants: {
              some: {
                ...(targetSizes.length > 0
                  ? { size: { in: targetSizes } }
                  : {}),
                ...(targetColors.length > 0
                  ? { color: { in: targetColors, mode: 'insensitive' } }
                  : {}),
                ...(inStock === true ? { stock: { gt: 0 } } : {}),
              },
            },
          }
        : {}),
    };

    // 4. Construct Sorting Strategy
    let orderBy:
      | Prisma.ProductOrderByWithRelationInput
      | Prisma.ProductOrderByWithRelationInput[] = {
      createdAt: 'desc',
    };

    switch (sortBy) {
      case ProductSortOption.PRICE_ASC:
        orderBy = { basePrice: 'asc' };
        break;
      case ProductSortOption.PRICE_DESC:
        orderBy = { basePrice: 'desc' };
        break;
      case ProductSortOption.RATING:
        orderBy = [{ reviews: { _count: 'desc' } }, { createdAt: 'desc' }];
        break;
      case ProductSortOption.POPULAR:
        orderBy = [{ isFeatured: 'desc' }, { createdAt: 'desc' }];
        break;
      case ProductSortOption.NEWEST:
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    // 5. Execute DB Query
    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          images: {
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          },
          variants: {
            orderBy: [{ color: 'asc' }, { size: 'asc' }],
          },
          _count: {
            select: {
              reviews: true,
            },
          },
        },
      }),
    ]);

    // 6. Format Product Output with Inventory Metrics & Color Swatches
    const formatted = products.map((p) => {
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
        id: p.id,
        title: p.title,
        slug: p.slug,
        description: p.description,
        details: p.details,
        fabricSpecs: p.fabricSpecs,
        washCare: p.washCare,
        tags: p.tags,
        basePrice: p.basePrice,
        discountPrice: p.discountPrice,
        category: p.category,
        isFeatured: p.isFeatured,
        isPublished: p.isPublished,
        gender: p.gender,
        season: p.season,
        primaryImage:
          p.images.find((img) => img.isPrimary) || p.images[0] || null,
        images: p.images,
        variants: p.variants,
        totalStock,
        inStock: totalStock > 0,
        availableSizes,
        availableColors,
        reviewCount: p._count.reviews,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    });

    // 7. Aggregate Facets for Frontend Filters (Color swatches, sizes, price min/max)
    const allMatchingVariants = products.flatMap((p) => p.variants);
    const facetSizes = Array.from(
      new Set(allMatchingVariants.map((v) => v.size)),
    );
    const facetColors = Array.from(
      new Set(
        allMatchingVariants.map((v) =>
          JSON.stringify({ color: v.color, colorCode: v.colorCode }),
        ),
      ),
    ).map((str) => JSON.parse(str) as { color: string; colorCode: string });

    const prices = products.map((p) => Number(p.basePrice));
    const priceRange = {
      min: prices.length > 0 ? Math.min(...prices) : 0,
      max: prices.length > 0 ? Math.max(...prices) : 0,
    };

    const totalPages = Math.ceil(total / limit);

    return {
      products: formatted,
      facets: {
        availableSizes: facetSizes,
        availableColors: facetColors,
        priceRange,
      },
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Public: Product Detail Page (PDP) & Cross-Sell Aggregator.
   * Returns complete product profile with:
   * - Gallery images and clothing variants
   * - Color swatches and available size breakdown with stock flags
   * - Category breadcrumb trail (Hierarchical ancestor path)
   * - Rating summary and rating star breakdown (5★, 4★, 3★, 2★, 1★)
   * - Active Flash Sale deal status (if live)
   * - "Related Products" recommendation carousel
   * - "Complete The Look" cross-sell recommendation styling set
   */
  async findBySlug(slug: string) {
    const now = new Date();

    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            parent: {
              select: {
                id: true,
                name: true,
                slug: true,
                parent: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
        images: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        },
        variants: {
          orderBy: [{ color: 'asc' }, { size: 'asc' }],
        },
        reviews: {
          take: 6,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            reviews: true,
            wishlists: true,
          },
        },
      },
    });

    if (!product || !product.isPublished) {
      throw new NotFoundException(`Product "${slug}" not found or unavailable`);
    }

    // 1. Build Category Breadcrumb Path (Root -> Sub -> Leaf)
    type CategoryNode = {
      id: string;
      name: string;
      slug: string;
      parent?: CategoryNode | null;
    };

    const categoryPath: Array<{ id: string; name: string; slug: string }> = [];
    let currCat: CategoryNode | null | undefined = product.category;
    while (currCat) {
      categoryPath.unshift({
        id: currCat.id,
        name: currCat.name,
        slug: currCat.slug,
      });
      currCat = currCat.parent;
    }

    // 2. Aggregate Rating Summary & Star Breakdown
    const [avgRatingRes, ratingCounts] = await Promise.all([
      this.prisma.review.aggregate({
        where: { productId: product.id },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      this.prisma.review.groupBy({
        by: ['rating'],
        where: { productId: product.id },
        _count: { rating: true },
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

    // 3. Group Variants by Color for Swatch Navigation
    const colorGroupMap = new Map<
      string,
      {
        color: string;
        colorCode: string;
        imageUrl?: string | null;
        totalStock: number;
        sizes: Array<{
          variantId: string;
          sku: string;
          size: string;
          stock: number;
          extraPrice: number;
          inStock: boolean;
        }>;
      }
    >();

    for (const v of product.variants) {
      const key = v.color.trim();
      if (!colorGroupMap.has(key)) {
        colorGroupMap.set(key, {
          color: v.color,
          colorCode: v.colorCode,
          imageUrl: v.imageUrl,
          totalStock: 0,
          sizes: [],
        });
      }

      const group = colorGroupMap.get(key)!;
      group.sizes.push({
        variantId: v.id,
        sku: v.sku,
        size: v.size,
        stock: v.stock,
        extraPrice: Number(v.extraPrice),
        inStock: v.stock > 0,
      });
      group.totalStock += v.stock;
    }
    const colorSwatches = Array.from(colorGroupMap.values());

    const totalStock = product.variants.reduce((acc, v) => acc + v.stock, 0);

    // 4. Check for Live Flash Sale Deal Campaign
    const liveFlashSaleItem = await this.prisma.flashSaleItem.findFirst({
      where: {
        productId: product.id,
        flashSale: {
          isActive: true,
          startTime: { lte: now },
          endTime: { gte: now },
        },
      },
      include: {
        flashSale: {
          select: {
            id: true,
            title: true,
            slug: true,
            endTime: true,
          },
        },
      },
    });

    const flashSaleDeal = liveFlashSaleItem
      ? {
          flashSaleId: liveFlashSaleItem.flashSale.id,
          campaignTitle: liveFlashSaleItem.flashSale.title,
          campaignSlug: liveFlashSaleItem.flashSale.slug,
          discountPrice: liveFlashSaleItem.discountPrice,
          discountPercent: liveFlashSaleItem.discountPercent,
          totalSaleStock: liveFlashSaleItem.quantityLimit,
          claimedStock: liveFlashSaleItem.soldCount,
          claimPercentage: Math.min(
            100,
            Math.round(
              (liveFlashSaleItem.soldCount / liveFlashSaleItem.quantityLimit) *
                100,
            ),
          ),
          endsAt: liveFlashSaleItem.flashSale.endTime,
        }
      : null;

    // 5. Cross-Sell: "Related Products" (Same category or matching tags)
    const orConditions: Prisma.ProductWhereInput[] = [
      { categoryId: product.categoryId },
      { tags: { hasSome: product.tags } },
    ];
    if (product.gender) {
      orConditions.push({
        gender: { equals: product.gender, mode: 'insensitive' },
      });
    }

    const relatedRaw = await this.prisma.product.findMany({
      where: {
        id: { not: product.id },
        isPublished: true,
        OR: orConditions,
      },
      take: 6,
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        slug: true,
        basePrice: true,
        discountPrice: true,
        category: {
          select: { id: true, name: true, slug: true },
        },
        images: {
          select: { url: true, altText: true, isPrimary: true },
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
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
    });
    const relatedProducts = relatedRaw.map((p) => this.formatProductCard(p));

    // 6. Cross-Sell: "Complete The Look" Recommendation Set
    const completeTheLook = await this.getCompleteTheLook(product);

    return {
      id: product.id,
      title: product.title,
      slug: product.slug,
      description: product.description,
      details: product.details,
      fabricSpecs: product.fabricSpecs,
      washCare: product.washCare,
      tags: product.tags,
      basePrice: product.basePrice,
      discountPrice: product.discountPrice,
      gender: product.gender,
      season: product.season,
      isFeatured: product.isFeatured,
      isPublished: product.isPublished,
      category: product.category,
      categoryPath,
      images: product.images,
      primaryImage:
        product.images.find((img) => img.isPrimary) ||
        product.images[0] ||
        null,
      inventory: {
        totalStock,
        inStock: totalStock > 0,
        isLowStock: totalStock > 0 && totalStock <= 10,
      },
      colorSwatches,
      variants: product.variants,
      ratings: {
        averageRating,
        totalReviews: product._count.reviews,
        breakdown: ratingBreakdown,
      },
      reviews: product.reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        isVerifiedPurchase: r.isVerifiedPurchase,
        user: r.user,
        createdAt: r.createdAt,
      })),
      flashSaleDeal,
      crossSells: {
        relatedProducts,
        completeTheLook,
      },
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  /**
   * Public: Dedicated Cross-Sell Recommendation Query.
   */
  async getCrossSellsBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      select: {
        id: true,
        categoryId: true,
        tags: true,
        gender: true,
        season: true,
        isPublished: true,
      },
    });

    if (!product || !product.isPublished) {
      throw new NotFoundException(`Product "${slug}" not found`);
    }

    const [relatedRaw, completeTheLook] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          id: { not: product.id },
          isPublished: true,
          OR: [
            { categoryId: product.categoryId },
            { tags: { hasSome: product.tags } },
          ],
        },
        take: 6,
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          title: true,
          slug: true,
          basePrice: true,
          discountPrice: true,
          category: { select: { id: true, name: true, slug: true } },
          images: {
            select: { url: true, altText: true, isPrimary: true },
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
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
      }),
      this.getCompleteTheLook(product),
    ]);

    return {
      relatedProducts: relatedRaw.map((p) => this.formatProductCard(p)),
      completeTheLook,
    };
  }

  /**
   * Public: Custom Fit & Size Recommendation Algorithm.
   * Compares user Height, Weight, Chest, Waist, and Fit Preference against standard clothing size charts.
   * Returns recommended size, best match percentage (e.g. 94%), fit feel explanation, and size breakdown.
   */
  async recommendSize(dto: SizeRecommendationDto) {
    const {
      heightCm,
      weightKg,
      chestInches,
      waistInches,
      fitPreference = FitPreference.REGULAR,
      gender = GenderPreference.MEN,
      productId,
    } = dto;

    // 1. Calculate Body Mass Index (BMI)
    const heightM = heightCm / 100;
    const bmi = Number((weightKg / (heightM * heightM)).toFixed(1));
    let bmiCategory = 'Normal';
    if (bmi < 18.5) bmiCategory = 'Slim / Underweight';
    else if (bmi >= 25 && bmi < 30) bmiCategory = 'Overweight';
    else if (bmi >= 30) bmiCategory = 'Heavy / Muscular';

    // 2. Estimate Chest and Waist if omitted using anthropometric formulas
    const estimatedChest =
      chestInches ?? this.estimateChestInches(heightCm, weightKg, gender);
    const estimatedWaist =
      waistInches ?? this.estimateWaistInches(heightCm, weightKg, gender);

    // 3. Apply Fit Preference Bias to Target Measurements
    let chestOffset = 0;
    let fitDescription = 'Standard regular fit draping naturally';
    switch (fitPreference) {
      case FitPreference.OVERSIZED:
        chestOffset = 2.0;
        fitDescription =
          'Boxy oversized streetwear silhouette with generous chest and drop shoulder drape';
        break;
      case FitPreference.RELAXED:
        chestOffset = 1.0;
        fitDescription =
          'Comfortable relaxed fit with extra breathing room around chest and arms';
        break;
      case FitPreference.SLIM:
        chestOffset = -1.0;
        fitDescription =
          'Tailored athletic fit contouring closely to chest and waist';
        break;
      case FitPreference.REGULAR:
      default:
        chestOffset = 0.0;
        fitDescription = 'Standard regular fit draping naturally';
        break;
    }

    const adjustedChest = estimatedChest + chestOffset;
    const adjustedWaist = estimatedWaist + chestOffset * 0.5;

    // 4. Standard Apparel Sizing Matrix (Men/Unisex Topwear & Streetwear)
    const sizeSpecs = [
      {
        size: 'S',
        chestMin: 36,
        chestMax: 38,
        chestIdeal: 37,
        waistIdeal: 30,
        heightIdeal: 165,
        weightIdeal: 58,
      },
      {
        size: 'M',
        chestMin: 39,
        chestMax: 41,
        chestIdeal: 40,
        waistIdeal: 33,
        heightIdeal: 173,
        weightIdeal: 69,
      },
      {
        size: 'L',
        chestMin: 42,
        chestMax: 44,
        chestIdeal: 43,
        waistIdeal: 36,
        heightIdeal: 180,
        weightIdeal: 80,
      },
      {
        size: 'XL',
        chestMin: 45,
        chestMax: 47,
        chestIdeal: 46,
        waistIdeal: 39,
        heightIdeal: 185,
        weightIdeal: 91,
      },
      {
        size: 'XXL',
        chestMin: 48,
        chestMax: 51,
        chestIdeal: 49.5,
        waistIdeal: 42.5,
        heightIdeal: 190,
        weightIdeal: 104,
      },
    ];

    // 5. Evaluate Multi-Factor Match Score for each Size
    const scoredSizes = sizeSpecs.map((spec) => {
      const chestScore = this.calcDimensionScore(
        adjustedChest,
        spec.chestIdeal,
        3.5,
      );
      const weightScore = this.calcDimensionScore(
        weightKg,
        spec.weightIdeal,
        11,
      );
      const heightScore = this.calcDimensionScore(
        heightCm,
        spec.heightIdeal,
        11,
      );
      const waistScore = this.calcDimensionScore(
        adjustedWaist,
        spec.waistIdeal,
        3.5,
      );

      // Weights: Chest (40%), Weight (30%), Height (20%), Waist (10%)
      const totalScore = Math.round(
        0.4 * chestScore +
          0.3 * weightScore +
          0.2 * heightScore +
          0.1 * waistScore,
      );

      return {
        size: spec.size,
        matchPercentage: Math.max(15, Math.min(99, totalScore)),
        chestTargetInches: `${spec.chestMin}-${spec.chestMax}"`,
      };
    });

    // Sort descending by match score
    scoredSizes.sort((a, b) => b.matchPercentage - a.matchPercentage);

    const primaryRecommendation = scoredSizes[0];
    const secondaryRecommendation = scoredSizes[1];

    // 6. If Product ID is supplied, check variant availability for the recommended size
    let productAvailability: {
      productId: string;
      recommendedSizeInStock: boolean;
      availableStock: number;
      matchingVariants: Array<{
        variantId: string;
        sku: string;
        color: string;
        colorCode: string;
        stock: number;
      }>;
    } | null = null;

    if (productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        include: {
          variants: {
            where: {
              size: primaryRecommendation.size,
            },
            select: {
              id: true,
              sku: true,
              color: true,
              colorCode: true,
              stock: true,
            },
          },
        },
      });

      if (product) {
        const totalStockForSize = product.variants.reduce(
          (sum, v) => sum + v.stock,
          0,
        );
        productAvailability = {
          productId,
          recommendedSizeInStock: totalStockForSize > 0,
          availableStock: totalStockForSize,
          matchingVariants: product.variants.map((v) => ({
            variantId: v.id,
            sku: v.sku,
            color: v.color,
            colorCode: v.colorCode,
            stock: v.stock,
          })),
        };
      }
    }

    return {
      recommendedSize: primaryRecommendation.size,
      matchPercentage: primaryRecommendation.matchPercentage,
      fitFeel: fitDescription,
      userBodyProfile: {
        heightCm,
        weightKg,
        chestInches: Number(estimatedChest.toFixed(1)),
        waistInches: Number(estimatedWaist.toFixed(1)),
        bmi,
        bmiCategory,
        fitPreference,
      },
      alternativeSize: {
        size: secondaryRecommendation.size,
        matchPercentage: secondaryRecommendation.matchPercentage,
        note:
          secondaryRecommendation.size > primaryRecommendation.size
            ? 'Choose for a more oversized / baggier fit'
            : 'Choose for a snugger / closer fit',
      },
      sizeBreakdown: scoredSizes,
      productAvailability,
    };
  }

  /**
   * Admin: Get single product by ID with full details.
   */
  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        images: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        },
        variants: {
          orderBy: [{ color: 'asc' }, { size: 'asc' }],
        },
        _count: {
          select: {
            orderItems: true,
            reviews: true,
            wishlists: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }

    const totalStock = product.variants.reduce((acc, v) => acc + v.stock, 0);

    return {
      ...product,
      totalStock,
      inStock: totalStock > 0,
    };
  }

  /**
   * Admin: Update product details, variants, and gallery inside a transaction.
   */
  async update(id: string, updateProductDto: UpdateProductDto) {
    await this.findOne(id);

    const { variants, images, categoryId, slug, ...rest } = updateProductDto;

    if (categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: categoryId },
      });
      if (!category) {
        throw new NotFoundException(
          `Category with ID "${categoryId}" not found`,
        );
      }
    }

    const dataToUpdate: Prisma.ProductUpdateInput = {
      ...rest,
      ...(slug ? { slug: this.slugify(slug) } : {}),
      ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
    };

    return this.prisma.$transaction(async (tx) => {
      // Sync Images if provided
      if (images !== undefined) {
        await tx.productImage.deleteMany({
          where: { productId: id },
        });

        if (images.length > 0) {
          const hasPrimary = images.some((img) => img.isPrimary === true);
          await tx.productImage.createMany({
            data: images.map((img, idx) => ({
              productId: id,
              url: img.url,
              altText:
                img.altText || `${rest.title || 'Product'} - View ${idx + 1}`,
              isPrimary: hasPrimary ? (img.isPrimary ?? false) : idx === 0,
              sortOrder: img.sortOrder ?? idx,
            })),
          });
        }
      }

      // Sync Variants if provided
      if (variants !== undefined && variants.length > 0) {
        await tx.productVariant.deleteMany({
          where: { productId: id },
        });

        await tx.productVariant.createMany({
          data: variants.map((v) => ({
            productId: id,
            sku: v.sku.toUpperCase().trim(),
            color: v.color.trim(),
            colorCode: v.colorCode.trim(),
            size: v.size.toUpperCase().trim(),
            stock: v.stock,
            extraPrice: v.extraPrice ?? 0,
            imageUrl: v.imageUrl,
          })),
        });
      }

      const updated = await tx.product.update({
        where: { id },
        data: dataToUpdate,
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
          images: {
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          },
          variants: {
            orderBy: [{ color: 'asc' }, { size: 'asc' }],
          },
        },
      });

      const totalStock = updated.variants.reduce((acc, v) => acc + v.stock, 0);

      return {
        ...updated,
        totalStock,
        inStock: totalStock > 0,
      };
    });
  }

  /**
   * Admin/Inventory: Quick stock adjuster for a specific SKU variant.
   */
  async updateVariantStock(variantId: string, stock: number) {
    if (stock < 0) {
      throw new BadRequestException('Stock cannot be negative');
    }

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });

    if (!variant) {
      throw new NotFoundException(`Variant with ID "${variantId}" not found`);
    }

    return this.prisma.productVariant.update({
      where: { id: variantId },
      data: { stock },
    });
  }

  /**
   * Admin: Toggle product publish status.
   */
  async togglePublish(id: string) {
    const product = await this.findOne(id);

    return this.prisma.product.update({
      where: { id },
      data: {
        isPublished: !product.isPublished,
      },
    });
  }

  /**
   * Admin: Toggle featured status.
   */
  async toggleFeatured(id: string) {
    const product = await this.findOne(id);

    return this.prisma.product.update({
      where: { id },
      data: {
        isFeatured: !product.isFeatured,
      },
    });
  }

  /**
   * Admin: Delete product (cascades variants and images).
   */
  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.product.delete({
      where: { id },
    });
  }

  // ── Helper Methods ──────────────────────────────────────────

  /**
   * Complete The Look Cross-Sell Aggregator.
   * First queries Lookbooks containing this product to get styled outfit pairs.
   * If not enough items, supplements with complementary category products.
   */
  private async getCompleteTheLook(product: {
    id: string;
    categoryId: string;
    gender?: string | null;
    season?: string | null;
  }) {
    const completeTheLookItems: Array<
      ReturnType<typeof this.formatProductCard>
    > = [];

    // 1. Look up Lookbook hotspots containing this product
    const hotspotLookbooks = await this.prisma.lookbookHotspot.findMany({
      where: {
        productId: product.id,
        lookbook: { isActive: true },
      },
      include: {
        lookbook: {
          include: {
            hotspots: {
              where: {
                productId: { not: product.id },
              },
              include: {
                product: {
                  select: {
                    id: true,
                    title: true,
                    slug: true,
                    basePrice: true,
                    discountPrice: true,
                    isPublished: true,
                    category: {
                      select: { id: true, name: true, slug: true },
                    },
                    images: {
                      select: { url: true, altText: true, isPrimary: true },
                      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
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
        },
      },
      take: 2,
    });

    let stylingLookbookContext: {
      id: string;
      title: string;
      slug: string;
      coverImageUrl: string;
    } | null = null;

    if (
      hotspotLookbooks.length > 0 &&
      hotspotLookbooks[0].lookbook.hotspots.length > 0
    ) {
      const lb = hotspotLookbooks[0].lookbook;
      stylingLookbookContext = {
        id: lb.id,
        title: lb.title,
        slug: lb.slug,
        coverImageUrl: lb.coverImageUrl,
      };

      for (const spot of lb.hotspots) {
        if (spot.product && spot.product.isPublished) {
          completeTheLookItems.push(this.formatProductCard(spot.product));
        }
      }
    }

    // 2. If fewer than 3 items found from lookbook, supplement with complementary categories (e.g. bottoms, jackets, accessories)
    if (completeTheLookItems.length < 3) {
      const existingIds = [
        product.id,
        ...completeTheLookItems.map((p) => p.id),
      ];

      const compWhere: Prisma.ProductWhereInput = {
        id: { notIn: existingIds },
        categoryId: { not: product.categoryId },
        isPublished: true,
      };

      if (product.gender) {
        compWhere.gender = { equals: product.gender, mode: 'insensitive' };
      }

      const complementary = await this.prisma.product.findMany({
        where: compWhere,
        take: 4 - completeTheLookItems.length,
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          title: true,
          slug: true,
          basePrice: true,
          discountPrice: true,
          category: {
            select: { id: true, name: true, slug: true },
          },
          images: {
            select: { url: true, altText: true, isPrimary: true },
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
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
      });

      for (const comp of complementary) {
        completeTheLookItems.push(this.formatProductCard(comp));
      }
    }

    return {
      stylingLookbook: stylingLookbookContext,
      items: completeTheLookItems,
    };
  }

  private formatProductCard(p: {
    id: string;
    title: string;
    slug: string;
    basePrice: Prisma.Decimal;
    discountPrice: Prisma.Decimal | null;
    category: { id: string; name: string; slug: string };
    images: Array<{ url: string; altText?: string | null; isPrimary: boolean }>;
    variants: Array<{
      id: string;
      size: string;
      color: string;
      colorCode: string;
      stock: number;
    }>;
  }) {
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
      id: p.id,
      title: p.title,
      slug: p.slug,
      basePrice: p.basePrice,
      discountPrice: p.discountPrice,
      category: p.category,
      primaryImage:
        p.images.find((img) => img.isPrimary) || p.images[0] || null,
      images: p.images,
      availableSizes,
      availableColors,
      totalStock,
      inStock: totalStock > 0,
    };
  }

  private async getCategoryAndChildrenIdsBySlug(
    slug: string,
  ): Promise<string[]> {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        children: {
          select: {
            id: true,
            children: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!category) {
      return [];
    }

    const ids = [category.id];
    for (const child of category.children) {
      ids.push(child.id);
      for (const grandChild of child.children) {
        ids.push(grandChild.id);
      }
    }

    return ids;
  }

  private emptyQueryResult(page: number, limit: number) {
    return {
      products: [],
      facets: {
        availableSizes: [],
        availableColors: [],
        priceRange: { min: 0, max: 0 },
      },
      meta: {
        total: 0,
        page,
        limit,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
  }

  private estimateChestInches(
    heightCm: number,
    weightKg: number,
    gender: string,
  ): number {
    const heightInches = heightCm / 2.54;
    if (gender === 'WOMEN') {
      return 18 + heightInches * 0.15 + weightKg * 0.22;
    }
    // Men & Unisex calculation
    return 19 + heightInches * 0.16 + weightKg * 0.24;
  }

  private estimateWaistInches(
    heightCm: number,
    weightKg: number,
    gender: string,
  ): number {
    const heightInches = heightCm / 2.54;
    if (gender === 'WOMEN') {
      return 14 + heightInches * 0.12 + weightKg * 0.21;
    }
    // Men & Unisex calculation
    return 15 + heightInches * 0.13 + weightKg * 0.23;
  }

  /**
   * Public: Get Fabric 360° & AR Texture details with macro zoom tiles, 360 turntable frames, hover video, and 3D AR model metadata.
   */
  async getFabricAndARPreview(slugOrId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        OR: [{ id: slugOrId }, { slug: slugOrId }],
        isPublished: true,
      },
      include: {
        images: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        },
        variants: {
          select: {
            id: true,
            color: true,
            colorCode: true,
            size: true,
            stock: true,
            imageUrl: true,
          },
        },
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(
        `Product "${slugOrId}" not found or unpublished`,
      );
    }

    const availableColors = Array.from(
      new Map(
        product.variants.map((v) => [
          v.color.toLowerCase(),
          {
            color: v.color,
            colorCode: v.colorCode,
            imageUrl: v.imageUrl,
            hasStock: v.stock > 0,
          },
        ]),
      ).values(),
    );

    return {
      productId: product.id,
      title: product.title,
      slug: product.slug,
      category: product.category,
      basePrice: Number(product.basePrice),
      discountPrice: product.discountPrice
        ? Number(product.discountPrice)
        : null,
      primaryImage: product.images[0]?.url ?? null,
      // 1. Fabric & Weave Macro Zoom
      fabric: {
        weave: product.fabricWeave || 'High-Density Premium Weave',
        specs: product.fabricSpecs,
        washCare: product.washCare,
        zoomImages:
          product.fabricZoomImages.length > 0
            ? product.fabricZoomImages
            : product.images.slice(0, 3).map((img) => img.url),
        textureZoomMagnification: '4x',
      },
      // 2. 3-5s Looping Hover Video
      media: {
        hoverVideoUrl: product.hoverVideoUrl || null,
        galleryImages: product.images.map((img) => img.url),
      },
      // 3. 360 Turntable Rotation
      view360: {
        isSupported: product.view360Urls.length > 0,
        frameCount: product.view360Urls.length,
        frameUrls: product.view360Urls,
      },
      // 4. 3D WebGL & AR Quick Look Metadata
      ar: {
        isSupported: Boolean(product.model3dUrl),
        model3dUrl: product.model3dUrl || null,
        arPlacement: product.arPlacement || 'FLOOR',
        quickLookSupported: Boolean(product.model3dUrl),
      },
      colorSwatches: availableColors,
    };
  }

  private calcDimensionScore(
    actual: number,
    ideal: number,
    tolerance: number,
  ): number {
    const diff = Math.abs(actual - ideal);
    return Math.max(0, 100 - (diff / tolerance) * 50);
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
