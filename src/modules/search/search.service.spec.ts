import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service.js';
import { PrismaService } from '../../database/prisma.service.js';

type MockPrismaService = {
  product: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
  };
};

describe('SearchService', () => {
  let service: SearchService;
  let prisma: MockPrismaService;

  const mockPrismaService: MockPrismaService = {
    product: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    prisma = module.get<MockPrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('voiceSearch', () => {
    it('should parse spoken intent chips and rank products accurately', async () => {
      prisma.product.findMany.mockResolvedValue([
        {
          id: 'p1',
          title: 'Premium Linen Shirt',
          slug: 'premium-linen-shirt',
          description: 'Breathable summer linen shirt in classic navy',
          fabricSpecs: '100% Organic Linen',
          fabricWeave: 'Linen Plain Weave',
          basePrice: '1800.00',
          discountPrice: null,
          category: { id: 'c1', name: 'Topwear', slug: 'topwear' },
          images: [
            { url: 'https://example.com/linen-shirt.jpg', isPrimary: true },
          ],
          tags: ['Summer', 'Linen', 'Navy'],
          variants: [
            {
              id: 'v1',
              sku: 'LNN-NVY-XL',
              color: 'Navy',
              colorCode: '#000080',
              size: 'XL',
              stock: 10,
              imageUrl: 'https://example.com/navy-linen.jpg',
            },
          ],
        },
      ]);

      const result = await service.voiceSearch({
        query: 'Show me a navy blue linen shirt under 2000 in size XL',
        limit: 10,
      });

      expect(result.parsedIntent.detectedColors).toContain('navy');
      expect(result.parsedIntent.detectedFabrics).toContain('linen');
      expect(result.parsedIntent.detectedSizes).toContain('xl');
      expect(result.parsedIntent.priceFilter?.max).toBe(2000);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.title).toBe('Premium Linen Shirt');
      expect(result.data[0]?.matchedVariant?.color).toBe('Navy');
    });
  });

  describe('visualSearch', () => {
    it('should calculate color distance and return matched products with similarity score', async () => {
      prisma.product.findMany.mockResolvedValue([
        {
          id: 'p1',
          title: 'Deep Indigo Denim Overshirt',
          slug: 'deep-indigo-denim-overshirt',
          basePrice: '2500.00',
          discountPrice: null,
          fabricWeave: '12oz Raw Denim',
          category: { id: 'c1', name: 'Topwear', slug: 'topwear' },
          images: [{ url: 'https://example.com/denim.jpg', isPrimary: true }],
          variants: [
            {
              id: 'v1',
              sku: 'DNM-IND-L',
              color: 'Deep Indigo',
              colorCode: '#1e293b',
              size: 'L',
              stock: 4,
              imageUrl: 'https://example.com/indigo.jpg',
            },
          ],
        },
      ]);

      const result = await service.visualSearch(null, {
        hexColor: '#1e293b',
        limit: 5,
      });

      expect(result.visualProfile.dominantColorHex).toBe('#1E293B');
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.similarityScore).toBe(100);
      expect(result.data[0]?.matchedVariant?.color).toBe('Deep Indigo');
    });
  });
});
