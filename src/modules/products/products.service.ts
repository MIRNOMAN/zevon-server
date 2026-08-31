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
   * Public: Get Product by SEO Slug with images, variants, breadcrumb, and related items.
   */
  async findBySlug(slug: string) {
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
          take: 5,
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
          },
        },
      },
    });

    if (!product || !product.isPublished) {
      throw new NotFoundException(`Product "${slug}" not found or unavailable`);
    }

    // Calculate aggregate review rating
    const avgRating = await this.prisma.review.aggregate({
      where: { productId: product.id },
      _avg: { rating: true },
    });

    // Fetch related products in the same category
    const relatedProducts = await this.prisma.product.findMany({
      where: {
        categoryId: product.categoryId,
        id: { not: product.id },
        isPublished: true,
      },
      take: 4,
      orderBy: { isFeatured: 'desc' },
      include: {
        images: {
          where: { isPrimary: true },
          take: 1,
        },
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    const totalStock = product.variants.reduce((acc, v) => acc + v.stock, 0);

    return {
      ...product,
      averageRating: avgRating._avg.rating
        ? Number(avgRating._avg.rating.toFixed(1))
        : 0,
      totalReviews: product._count.reviews,
      totalStock,
      inStock: totalStock > 0,
      relatedProducts,
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
