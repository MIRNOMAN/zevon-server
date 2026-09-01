import { Test, TestingModule } from '@nestjs/testing';
import { OutfitsService } from './outfits.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { OutfitSlot } from '@prisma/client';

describe('OutfitsService', () => {
  let service: OutfitsService;
  let prisma: any;

  const mockPrismaService = {
    outfit: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    outfitItem: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    product: {
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    productVariant: {
      findMany: jest.fn(),
    },
    cart: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    cartItem: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutfitsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<OutfitsService>(OutfitsService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated outfits with calculated bundle price', async () => {
      prisma.outfit.count.mockResolvedValue(1);
      prisma.outfit.findMany.mockResolvedValue([
        {
          id: 'outfit_1',
          title: 'Minimalist Street Outfit',
          slug: 'minimalist-street-outfit',
          description: 'A great streetwear combination',
          coverImageUrl: 'https://example.com/cover.jpg',
          occasion: 'Streetwear',
          gender: 'MEN',
          tags: ['Streetwear'],
          bundleDiscountPercent: 10,
          isCurated: true,
          viewsCount: 42,
          items: [
            {
              slot: OutfitSlot.TOP,
              productId: 'p1',
              positionX: 50,
              positionY: 25,
              product: {
                id: 'p1',
                title: 'Oversized Tee',
                slug: 'oversized-tee',
                basePrice: '1500.00',
                discountPrice: '1200.00',
                images: [{ url: 'https://example.com/tee.jpg' }],
              },
            },
            {
              slot: OutfitSlot.BOTTOM,
              productId: 'p2',
              positionX: 50,
              positionY: 65,
              product: {
                id: 'p2',
                title: 'Cargo Pants',
                slug: 'cargo-pants',
                basePrice: '2000.00',
                discountPrice: null,
                images: [{ url: 'https://example.com/pants.jpg' }],
              },
            },
          ],
        },
      ]);

      const result = await service.findAll({ page: 1, limit: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.bundlePrice).toBe(2880); // (1200 + 2000) * 0.9 = 2880
      expect(result.data[0]?.savingsAmount).toBe(320);
    });
  });

  describe('calculateBundleTotal', () => {
    it('should compute real-time live bundle total and savings for selected variants', async () => {
      prisma.productVariant.findMany.mockResolvedValue([
        {
          id: 'var_top',
          color: 'Black',
          colorCode: '#000000',
          size: 'L',
          sku: 'TEE-BLK-L',
          stock: 5,
          extraPrice: '0.00',
          imageUrl: null,
          product: {
            id: 'p1',
            title: 'French Terry Tee',
            slug: 'french-terry-tee',
            basePrice: '1500.00',
            discountPrice: null,
            category: { id: 'c1', name: 'Topwear', slug: 'topwear' },
            images: [{ url: 'https://example.com/tee.jpg' }],
          },
        },
        {
          id: 'var_bottom',
          color: 'Charcoal',
          colorCode: '#333333',
          size: '32',
          sku: 'CHINO-CHR-32',
          stock: 3,
          extraPrice: '100.00',
          imageUrl: null,
          product: {
            id: 'p2',
            title: 'Relaxed Chino',
            slug: 'relaxed-chino',
            basePrice: '2200.00',
            discountPrice: '2000.00',
            category: { id: 'c2', name: 'Bottomwear', slug: 'bottomwear' },
            images: [{ url: 'https://example.com/chino.jpg' }],
          },
        },
      ]);

      const result = await service.calculateBundleTotal({
        variantIds: ['var_top', 'var_bottom'],
        bundleDiscountPercent: 10,
      });

      // Item 1: 1500 + 0 = 1500
      // Item 2: 2000 (discount) + 100 (extra) = 2100
      // Subtotal = 3600
      // 10% discount = 360, Total = 3240
      expect(result.subtotal).toBe(3600);
      expect(result.bundleSavings).toBe(360);
      expect(result.bundleTotalPrice).toBe(3240);
      expect(result.canCheckout).toBe(true);
    });
  });
});
