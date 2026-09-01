import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationsService } from './recommendations.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { Decimal } from '@prisma/client/runtime/library';

describe('RecommendationsService', () => {
  let service: RecommendationsService;
  let prisma: jest.Mocked<PrismaService>;

  const mockProduct = {
    id: 'prod-1',
    title: 'Oversized Streetwear Tee',
    slug: 'oversized-streetwear-tee',
    basePrice: new Decimal(1200),
    discountPrice: null,
    categoryId: 'cat-1',
    tags: ['streetwear', 'oversized', 'summer'],
    isPublished: true,
    isFeatured: true,
    category: { id: 'cat-1', name: 'T-Shirts', slug: 't-shirts' },
    images: [{ url: 'https://cdn.zevon.com/tee.jpg' }],
    variants: [
      { id: 'v1', size: 'M', color: 'Black', stock: 10, extraPrice: new Decimal(0), sku: 'TEE-M' },
    ],
  };

  const mockSimilarProduct = {
    id: 'prod-2',
    title: 'Vintage Acid Wash Tee',
    slug: 'vintage-acid-wash-tee',
    basePrice: new Decimal(1300),
    discountPrice: null,
    categoryId: 'cat-1',
    tags: ['streetwear', 'vintage'],
    isPublished: true,
    category: { id: 'cat-1', name: 'T-Shirts', slug: 't-shirts' },
    images: [{ url: 'https://cdn.zevon.com/tee2.jpg' }],
    variants: [{ size: 'L', color: 'Grey', stock: 5 }],
    reviews: [{ rating: 5 }],
  };

  beforeEach(async () => {
    const prismaMock = {
      product: {
        findUnique: jest.fn().mockResolvedValue(mockProduct),
        findMany: jest.fn().mockResolvedValue([mockSimilarProduct]),
      },
      productView: {
        create: jest.fn().mockResolvedValue({ id: 'view-1', viewedAt: new Date() }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'view-1',
            productId: 'prod-1',
            viewedAt: new Date(),
            product: mockProduct,
          },
        ]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<RecommendationsService>(RecommendationsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('trackView', () => {
    it('should record product view browsing event', async () => {
      const res = await service.trackView({ productId: 'prod-1' }, 'user-1');
      expect(res.recorded).toBe(true);
      expect(prisma.productView.create).toHaveBeenCalledWith({
        data: {
          productId: 'prod-1',
          userId: 'user-1',
          sessionId: null,
        },
      });
    });
  });

  describe('getRecentlyViewed', () => {
    it('should retrieve deduplicated recently viewed products list', async () => {
      const res = await service.getRecentlyViewed({ userId: 'user-1', limit: 5 });
      expect(res.total).toBe(1);
      expect(res.items[0].title).toBe('Oversized Streetwear Tee');
      expect(res.items[0].inStock).toBe(true);
    });
  });

  describe('getYouMayAlsoLike', () => {
    it('should score and recommend similar products based on category and tags', async () => {
      const res = await service.getYouMayAlsoLike('prod-1', 4);
      expect(res.targetProduct.title).toBe('Oversized Streetwear Tee');
      expect(res.recommendations).toHaveLength(1);
      expect(res.recommendations[0].title).toBe('Vintage Acid Wash Tee');
    });
  });
});
