import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  ReorderCategoriesDto,
} from './dto/index.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Public Category & Mega-Menu Endpoints ────────────────────

  /**
   * Public: Get complete hierarchical Category Tree for Frontend Mega-Menu / Header Navigation.
   * Fetches active root categories (parentId: null) with nested active sub-categories and accurate hierarchical product counts.
   */
  async getMegaMenuTree() {
    const rootCategories = await this.prisma.category.findMany({
      where: {
        parentId: null,
        isActive: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        children: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            children: {
              where: { isActive: true },
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
    });

    // Gather all category IDs to compute accurate product counts
    const allCatIds: string[] = [];
    for (const root of rootCategories) {
      allCatIds.push(root.id);
      for (const sub of root.children) {
        allCatIds.push(sub.id);
        for (const leaf of sub.children) {
          allCatIds.push(leaf.id);
        }
      }
    }

    const descendantMap = await this.getAllCategoryDescendantIds(allCatIds);

    const productCounts = await this.prisma.product.groupBy({
      by: ['categoryId'],
      where: { isPublished: true },
      _count: { id: true },
    });

    const countByCatId = new Map<string, number>();
    for (const p of productCounts) {
      countByCatId.set(p.categoryId, p._count.id);
    }

    const getCountFor = (id: string) => {
      const descendants = descendantMap.get(id) || [id];
      return descendants.reduce(
        (sum, cid) => sum + (countByCatId.get(cid) || 0),
        0,
      );
    };

    return rootCategories.map((root) => ({
      id: root.id,
      name: root.name,
      slug: root.slug,
      description: root.description,
      imageUrl: root.imageUrl,
      sortOrder: root.sortOrder,
      _count: {
        products: getCountFor(root.id),
      },
      children: root.children.map((sub) => ({
        id: sub.id,
        name: sub.name,
        slug: sub.slug,
        description: sub.description,
        imageUrl: sub.imageUrl,
        sortOrder: sub.sortOrder,
        parentId: sub.parentId,
        _count: {
          products: getCountFor(sub.id),
        },
        children: sub.children.map((leaf) => ({
          id: leaf.id,
          name: leaf.name,
          slug: leaf.slug,
          sortOrder: leaf.sortOrder,
          parentId: leaf.parentId,
          _count: {
            products: getCountFor(leaf.id),
          },
        })),
      })),
    }));
  }

  /**
   * Public: List active categories with optional filtering by parentId or root-only with accurate total product counts.
   */
  async findAll(onlyRoot = false, parentId?: string) {
    const where: Prisma.CategoryWhereInput = {
      isActive: true,
      ...(onlyRoot ? { parentId: null } : {}),
      ...(parentId !== undefined ? { parentId } : {}),
    };

    const categories = await this.prisma.category.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        children: {
          where: { isActive: true },
          select: { id: true },
        },
      },
    });

    const categoryIds = categories.map((c) => c.id);
    const descendantMap = await this.getAllCategoryDescendantIds(categoryIds);

    const productCounts = await this.prisma.product.groupBy({
      by: ['categoryId'],
      where: { isPublished: true },
      _count: { id: true },
    });

    const countByCatId = new Map<string, number>();
    for (const p of productCounts) {
      countByCatId.set(p.categoryId, p._count.id);
    }

    return categories.map((cat) => {
      const descendants = descendantMap.get(cat.id) || [cat.id];
      const totalProducts = descendants.reduce(
        (sum, id) => sum + (countByCatId.get(id) || 0),
        0,
      );

      return {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        imageUrl: cat.imageUrl,
        sortOrder: cat.sortOrder,
        parentId: cat.parentId,
        isActive: cat.isActive,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
        _count: {
          products: totalProducts,
          children: cat.children.length,
        },
      };
    });
  }

  /**
   * Public: Get single category by slug with parent hierarchy (breadcrumb) and immediate sub-categories.
   */
  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
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
        children: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }],
          select: {
            id: true,
            name: true,
            slug: true,
            imageUrl: true,
            _count: {
              select: {
                products: true,
              },
            },
          },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!category || !category.isActive) {
      throw new NotFoundException(`Category "${slug}" not found`);
    }

    return category;
  }

  // ── Admin Category Operations ────────────────────────────────

  /**
   * Admin: Create a new category or sub-category with auto slug generation.
   */
  async create(createCategoryDto: CreateCategoryDto) {
    const { name, slug, parentId, ...rest } = createCategoryDto;

    if (parentId) {
      const parentExists = await this.prisma.category.findUnique({
        where: { id: parentId },
      });
      if (!parentExists) {
        throw new NotFoundException(
          `Parent category with ID "${parentId}" not found`,
        );
      }
    }

    const generatedSlug = slug ? this.slugify(slug) : this.slugify(name);

    const existingSlug = await this.prisma.category.findUnique({
      where: { slug: generatedSlug },
    });

    if (existingSlug) {
      throw new ConflictException(
        `Category with slug "${generatedSlug}" already exists. Please choose a different name or slug.`,
      );
    }

    return this.prisma.category.create({
      data: {
        ...rest,
        name,
        slug: generatedSlug,
        parentId: parentId || null,
      },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  /**
   * Admin: List all categories with search, parent filtering, status, and pagination.
   */
  async findAllAdmin(
    page = 1,
    limit = 20,
    parentId?: string,
    isActive?: boolean,
    search?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.CategoryWhereInput = {
      ...(parentId !== undefined
        ? { parentId: parentId === 'null' ? null : parentId }
        : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, categories] = await Promise.all([
      this.prisma.category.count({ where }),
      this.prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: {
          parent: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              products: true,
              children: true,
            },
          },
        },
      }),
    ]);

    return {
      categories,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin: Get single category by ID with full details.
   */
  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: {
          orderBy: [{ sortOrder: 'asc' }],
        },
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }

    return category;
  }

  /**
   * Admin: Update category details with circular hierarchy prevention.
   */
  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const category = await this.findOne(id);

    const { name, slug, parentId, ...rest } = updateCategoryDto;

    // Prevent assigning category as its own parent
    if (parentId !== undefined) {
      if (parentId === id) {
        throw new BadRequestException('A category cannot be its own parent');
      }

      if (parentId !== null) {
        const parent = await this.prisma.category.findUnique({
          where: { id: parentId },
        });
        if (!parent) {
          throw new NotFoundException(
            `Parent category with ID "${parentId}" not found`,
          );
        }

        // Prevent setting a child as parent (circular reference check)
        const isDescendant = await this.checkIsDescendant(id, parentId);
        if (isDescendant) {
          throw new BadRequestException(
            'Cannot set a sub-category/descendant as the parent category',
          );
        }
      }
    }

    let finalSlug: string | undefined;
    if (slug) {
      finalSlug = this.slugify(slug);
    } else if (name && name !== category.name) {
      finalSlug = this.slugify(name);
    }

    if (finalSlug && finalSlug !== category.slug) {
      const existingSlug = await this.prisma.category.findUnique({
        where: { slug: finalSlug },
      });
      if (existingSlug) {
        throw new ConflictException(
          `Category with slug "${finalSlug}" already exists`,
        );
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        ...rest,
        ...(name ? { name } : {}),
        ...(finalSlug ? { slug: finalSlug } : {}),
        ...(parentId !== undefined ? { parentId: parentId || null } : {}),
      },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  /**
   * Admin: Toggle category visibility status.
   */
  async toggleStatus(id: string) {
    const category = await this.findOne(id);

    return this.prisma.category.update({
      where: { id },
      data: {
        isActive: !category.isActive,
      },
    });
  }

  /**
   * Admin: Bulk reorder categories for mega-menu and sidebar.
   */
  async reorder(reorderCategoriesDto: ReorderCategoriesDto) {
    return this.prisma.$transaction(
      reorderCategoriesDto.items.map((item) =>
        this.prisma.category.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );
  }

  /**
   * Admin: Delete category.
   */
  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.category.delete({
      where: { id },
    });
  }

  // ── Helper Methods ──────────────────────────────────────────

  /**
   * Helper: Get all descendant category IDs for each category in the given list.
   */
  private async getAllCategoryDescendantIds(
    categoryIds: string[],
  ): Promise<Map<string, string[]>> {
    const allCategories = await this.prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, parentId: true },
    });

    const descendantMap = new Map<string, string[]>();

    // Build parent-to-children mapping
    const childrenMap = new Map<string, string[]>();
    for (const cat of allCategories) {
      if (cat.parentId) {
        if (!childrenMap.has(cat.parentId)) {
          childrenMap.set(cat.parentId, []);
        }
        childrenMap.get(cat.parentId)!.push(cat.id);
      }
    }

    // Traverse descendants for each category ID
    for (const rootId of categoryIds) {
      const descendants: string[] = [rootId];
      const queue = [rootId];
      while (queue.length > 0) {
        const current = queue.shift()!;
        const children = childrenMap.get(current) || [];
        for (const child of children) {
          descendants.push(child);
          queue.push(child);
        }
      }
      descendantMap.set(rootId, descendants);
    }

    return descendantMap;
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

  private async checkIsDescendant(
    parentIdToCheck: string,
    targetId: string,
  ): Promise<boolean> {
    let current = await this.prisma.category.findUnique({
      where: { id: targetId },
      select: { parentId: true },
    });

    while (current && current.parentId) {
      if (current.parentId === parentIdToCheck) {
        return true;
      }
      current = await this.prisma.category.findUnique({
        where: { id: current.parentId },
        select: { parentId: true },
      });
    }

    return false;
  }
}
