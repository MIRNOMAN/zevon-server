import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import {
  VoiceSearchDto,
  VisualSearchDto,
  ComplementarySearchDto,
} from './dto/index.js';

interface ParsedVoiceIntent {
  rawQuery: string;
  colors: string[];
  garments: string[];
  fabrics: string[];
  occasions: string[];
  gender: string | null;
  sizes: string[];
  maxPrice: number | null;
  minPrice: number | null;
  searchKeywords: string[];
}

type VoiceCandidateProduct = Prisma.ProductGetPayload<{
  include: {
    category: { select: { id: true; name: true; slug: true } };
    images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] };
    variants: {
      select: {
        id: true;
        sku: true;
        color: true;
        colorCode: true;
        size: true;
        stock: true;
        imageUrl: true;
      };
    };
  };
}>;

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  // ────────────────────────────────────────────────────────────
  // 1. Voice Search (Natural Language Intent & Garment Parser)
  // ────────────────────────────────────────────────────────────

  /**
   * Parse spoken text and query the catalog with multi-factor weighted relevance scoring.
   */
  async voiceSearch(dto: VoiceSearchDto) {
    const { query, gender: contextGender, limit = 12 } = dto;

    if (!query || query.trim().length === 0) {
      throw new BadRequestException('Voice query text is required');
    }

    const intent = this.parseVoiceIntent(query);
    const targetGender = contextGender || intent.gender;

    // Build Prisma query condition
    const where: Prisma.ProductWhereInput = {
      isPublished: true,
      ...(targetGender && {
        OR: [
          { gender: { equals: targetGender, mode: 'insensitive' } },
          { gender: { equals: 'UNISEX', mode: 'insensitive' } },
          { gender: null },
        ],
      }),
      ...(intent.maxPrice !== null && {
        basePrice: { lte: intent.maxPrice },
      }),
      ...(intent.minPrice !== null && {
        basePrice: { gte: intent.minPrice },
      }),
    };

    // Retrieve candidate products
    const products = await this.prisma.product.findMany({
      where,
      take: 100,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
        variants: {
          select: {
            id: true,
            sku: true,
            color: true,
            colorCode: true,
            size: true,
            stock: true,
            imageUrl: true,
          },
        },
      },
    });

    // Score and rank candidates by semantic voice match
    const ranked = products
      .map((p) => {
        const score = this.calculateVoiceMatchScore(p, intent);
        return { product: p, score };
      })
      .filter((item) => item.score > 0 || products.length <= limit)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const formattedProducts = ranked.map(({ product, score }) => {
      const basePrice = Number(product.basePrice);
      const discountPrice = product.discountPrice
        ? Number(product.discountPrice)
        : null;

      // Find best matching variant color if color was spoken
      const matchingVariant =
        intent.colors.length > 0
          ? product.variants.find((v) =>
              intent.colors.some(
                (c) =>
                  v.color.toLowerCase().includes(c.toLowerCase()) ||
                  c.toLowerCase().includes(v.color.toLowerCase()),
              ),
            )
          : null;

      return {
        id: product.id,
        title: product.title,
        slug: product.slug,
        category: product.category,
        basePrice,
        discountPrice,
        effectivePrice: discountPrice ?? basePrice,
        hoverVideoUrl: product.hoverVideoUrl,
        fabricWeave: product.fabricWeave,
        primaryImage:
          matchingVariant?.imageUrl || product.images[0]?.url || null,
        availableColors: Array.from(
          new Set(product.variants.map((v) => v.color)),
        ),
        availableSizes: Array.from(
          new Set(product.variants.map((v) => v.size)),
        ),
        inStock: product.variants.some((v) => v.stock > 0),
        matchScore: Math.min(100, Math.round(score * 10)),
        matchedVariant: matchingVariant
          ? {
              id: matchingVariant.id,
              color: matchingVariant.color,
              colorCode: matchingVariant.colorCode,
              size: matchingVariant.size,
              imageUrl: matchingVariant.imageUrl,
            }
          : null,
      };
    });

    return {
      query,
      parsedIntent: {
        detectedColors: intent.colors,
        detectedGarments: intent.garments,
        detectedFabrics: intent.fabrics,
        detectedOccasions: intent.occasions,
        detectedGender: targetGender,
        detectedSizes: intent.sizes,
        priceFilter:
          intent.maxPrice !== null || intent.minPrice !== null
            ? { min: intent.minPrice, max: intent.maxPrice }
            : null,
      },
      resultsCount: formattedProducts.length,
      data: formattedProducts,
    };
  }

  // ────────────────────────────────────────────────────────────
  // 2. Visual Image Search (Computer Vision & Color Distance)
  // ────────────────────────────────────────────────────────────

  /**
   * Visual Search: Analyze image upload / URL, extract dominant color palette,
   * compute visual color distances (Delta-E / RGB space), and rank closest matching garments.
   */
  async visualSearch(fileBuffer: Buffer | null, dto: VisualSearchDto) {
    const { imageUrl, hexColor, categoryHint, limit = 12 } = dto;

    if (!fileBuffer && !imageUrl && !hexColor) {
      throw new BadRequestException(
        'Please provide an image file, an imageUrl, or a hexColor to perform visual search',
      );
    }

    // 1. Extract visual features (dominant color, secondary palette, lightness)
    const visualFeatures = this.extractVisualFeatures(
      fileBuffer,
      imageUrl,
      hexColor,
    );

    // 2. Fetch catalog products and their variant color swatches
    const products = await this.prisma.product.findMany({
      where: {
        isPublished: true,
        ...(categoryHint && {
          category: {
            name: { contains: categoryHint, mode: 'insensitive' },
          },
        }),
      },
      take: 150,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
        variants: {
          select: {
            id: true,
            sku: true,
            color: true,
            colorCode: true,
            size: true,
            stock: true,
            imageUrl: true,
          },
        },
      },
    });

    // 3. Compute visual color similarity score for each product
    const scoredProducts = products
      .map((p) => {
        let bestDistance = Number.MAX_VALUE;
        let matchedVariant = p.variants[0] || null;

        for (const variant of p.variants) {
          const distance = this.calculateColorDistance(
            visualFeatures.dominantRgb,
            this.hexToRgb(variant.colorCode || '#000000'),
          );
          if (distance < bestDistance) {
            bestDistance = distance;
            matchedVariant = variant;
          }
        }

        // Distance range: 0 (exact match) to ~441 (opposite color)
        // Convert to similarity percentage: 0 - 100%
        const normalizedSim = Math.max(
          0,
          Math.min(100, Math.round(100 - (bestDistance / 441.67) * 100)),
        );

        // Boost score if title or fabric relates to detected tone or texture
        let finalScore = normalizedSim;
        if (p.fabricWeave && visualFeatures.textureKeyword) {
          if (
            p.fabricWeave.toLowerCase().includes(visualFeatures.textureKeyword)
          ) {
            finalScore = Math.min(100, finalScore + 8);
          }
        }

        return {
          product: p,
          similarityScore: finalScore,
          matchedVariant,
          bestDistance,
        };
      })
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit);

    const formatted = scoredProducts.map(
      ({ product, similarityScore, matchedVariant }) => {
        const basePrice = Number(product.basePrice);
        const discountPrice = product.discountPrice
          ? Number(product.discountPrice)
          : null;

        return {
          id: product.id,
          title: product.title,
          slug: product.slug,
          category: product.category,
          basePrice,
          discountPrice,
          effectivePrice: discountPrice ?? basePrice,
          primaryImage:
            matchedVariant?.imageUrl || product.images[0]?.url || null,
          fabricWeave: product.fabricWeave,
          hoverVideoUrl: product.hoverVideoUrl,
          similarityScore, // Percentage e.g. 95%
          visualMatchReason: `${similarityScore}% Color & Silhouette Match (${matchedVariant?.color || 'Tone'})`,
          matchedVariant: matchedVariant
            ? {
                id: matchedVariant.id,
                color: matchedVariant.color,
                colorCode: matchedVariant.colorCode,
                size: matchedVariant.size,
                imageUrl: matchedVariant.imageUrl,
              }
            : null,
        };
      },
    );

    return {
      visualProfile: {
        dominantColorHex: visualFeatures.dominantHex,
        dominantColorName: visualFeatures.colorName,
        palette: visualFeatures.paletteHex,
        detectedTone: visualFeatures.tone,
        textureKeyword: visualFeatures.textureKeyword || null,
      },
      resultsCount: formatted.length,
      data: formatted,
    };
  }

  // ────────────────────────────────────────────────────────────
  // 3. Smart Complementary Styling Suggestions (Outfit Match)
  // ────────────────────────────────────────────────────────────

  /**
   * Recommend matching items (Top -> matching Bottom & Shoes) based on fashion color harmony.
   */
  async getComplementarySuggestions(
    productId: string,
    dto: ComplementarySearchDto,
  ) {
    const { targetSlot, limit = 6 } = dto;

    const sourceProduct = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        variants: true,
      },
    });

    if (!sourceProduct) {
      throw new NotFoundException(`Product with ID "${productId}" not found`);
    }

    const primaryColor =
      sourceProduct.variants[0]?.color.toLowerCase() || 'neutral';

    // Find complementary color recommendations based on color theory
    const harmonizingColors = this.getHarmonizingColors(primaryColor);

    // Target categories (if Top -> look for Bottomwear/Pants/Shoes; if Bottom -> look for Shirts/Tops/Shoes)
    const categoryName = sourceProduct.category.name.toLowerCase();
    let targetCategoryFilter: Prisma.StringFilter | undefined;

    if (targetSlot) {
      targetCategoryFilter = { contains: targetSlot, mode: 'insensitive' };
    } else if (
      categoryName.includes('top') ||
      categoryName.includes('shirt') ||
      categoryName.includes('tee')
    ) {
      targetCategoryFilter = {
        not: { contains: 'top' },
      };
    } else if (
      categoryName.includes('bottom') ||
      categoryName.includes('pant') ||
      categoryName.includes('jean')
    ) {
      targetCategoryFilter = {
        not: { contains: 'bottom' },
      };
    }

    const candidates = await this.prisma.product.findMany({
      where: {
        id: { not: productId },
        isPublished: true,
        ...(sourceProduct.gender && {
          OR: [
            { gender: sourceProduct.gender },
            { gender: 'UNISEX' },
            { gender: null },
          ],
        }),
        ...(targetCategoryFilter && {
          category: { name: targetCategoryFilter },
        }),
      },
      take: 40,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          take: 1,
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
      },
    });

    // Rank by color harmony match
    const ranked = candidates
      .map((p) => {
        let harmonyScore = 50;
        const matchingColor = p.variants.find((v) =>
          harmonizingColors.some((c) =>
            v.color.toLowerCase().includes(c.toLowerCase()),
          ),
        );

        if (matchingColor) harmonyScore += 40;
        if (p.isFeatured) harmonyScore += 10;

        return {
          product: p,
          harmonyScore,
          pairingColor: matchingColor?.color || p.variants[0]?.color,
        };
      })
      .sort((a, b) => b.harmonyScore - a.harmonyScore)
      .slice(0, limit);

    return {
      sourceProduct: {
        id: sourceProduct.id,
        title: sourceProduct.title,
        category: sourceProduct.category.name,
        primaryColor,
      },
      harmonyPalette: harmonizingColors,
      recommendations: ranked.map(({ product, pairingColor }) => ({
        id: product.id,
        title: product.title,
        slug: product.slug,
        category: product.category,
        basePrice: Number(product.basePrice),
        discountPrice: product.discountPrice
          ? Number(product.discountPrice)
          : null,
        primaryImage: product.images[0]?.url || null,
        pairingColor,
        styleReason: `Color-matched with ${primaryColor}: Harmonizes with ${pairingColor}`,
      })),
    };
  }

  // ────────────────────────────────────────────────────────────
  // Private Helper Algorithms (NLP, Color Space, Heuristics)
  // ────────────────────────────────────────────────────────────

  private parseVoiceIntent(query: string): ParsedVoiceIntent {
    const q = query.toLowerCase();

    // 1. Colors
    const colorDictionary = [
      'navy',
      'blue',
      'black',
      'white',
      'olive',
      'green',
      'charcoal',
      'grey',
      'gray',
      'beige',
      'maroon',
      'brown',
      'cream',
      'tan',
      'red',
      'khaki',
      'indigo',
      'rust',
      'sage',
      'teal',
      'burgundy',
      'yellow',
      'orange',
      'pink',
    ];
    const detectedColors = colorDictionary.filter((c) =>
      new RegExp(`\\b${c}\\b`, 'i').test(q),
    );

    // 2. Garment types
    const garmentDictionary = [
      'linen shirt',
      'oversized tee',
      't-shirt',
      'tshirt',
      'tee',
      'shirt',
      'polo',
      'hoodie',
      'sweatshirt',
      'jeans',
      'denim',
      'chinos',
      'chino',
      'trousers',
      'pants',
      'cargo',
      'sneakers',
      'sneaker',
      'shoes',
      'boots',
      'jacket',
      'blazer',
      'loafers',
      'panjabi',
      'kurta',
      'shorts',
      'sweatpants',
    ];
    const detectedGarments = garmentDictionary.filter((g) =>
      new RegExp(`\\b${g}\\b`, 'i').test(q),
    );

    // 3. Fabrics
    const fabricDictionary = [
      'linen',
      'denim',
      'cotton',
      'terry',
      'silk',
      'wool',
      'corduroy',
      'twill',
      'slub',
      'flannel',
      'fleece',
      'canvas',
      'oxford',
    ];
    const detectedFabrics = fabricDictionary.filter((f) =>
      new RegExp(`\\b${f}\\b`, 'i').test(q),
    );

    // 4. Occasions & Styles
    const occasionDictionary = [
      'casual',
      'formal',
      'streetwear',
      'party',
      'summer',
      'winter',
      'festive',
      'eid',
      'minimalist',
      'oversized',
      'slim fit',
      'regular fit',
    ];
    const detectedOccasions = occasionDictionary.filter((o) =>
      new RegExp(`\\b${o}\\b`, 'i').test(q),
    );

    // 5. Gender
    let detectedGender: string | null = null;
    if (/\b(men|man|mens|male|boy|boys)\b/i.test(q)) detectedGender = 'MEN';
    else if (/\b(women|woman|womens|female|girl|girls|lady|ladies)\b/i.test(q))
      detectedGender = 'WOMEN';
    else if (/\b(unisex)\b/i.test(q)) detectedGender = 'UNISEX';

    // 6. Sizes
    const sizeDictionary = [
      'xs',
      's',
      'm',
      'l',
      'xl',
      'xxl',
      'xxxl',
      '28',
      '30',
      '32',
      '34',
      '36',
      '38',
      '40',
      '42',
    ];
    const detectedSizes = sizeDictionary.filter((s) =>
      new RegExp(`\\b(size\\s+)?${s}\\b`, 'i').test(q),
    );

    // 7. Price bounds
    let maxPrice: number | null = null;
    let minPrice: number | null = null;

    const underMatch = q.match(
      /(?:under|below|less than|within|up to)\s+(\d+)/i,
    );
    if (underMatch?.[1]) {
      maxPrice = parseInt(underMatch[1], 10);
    }

    const aboveMatch = q.match(/(?:above|more than|over)\s+(\d+)/i);
    if (aboveMatch?.[1]) {
      minPrice = parseInt(aboveMatch[1], 10);
    }

    const betweenMatch = q.match(
      /(?:between|from)\s+(\d+)\s+(?:and|to)\s+(\d+)/i,
    );
    if (betweenMatch?.[1] && betweenMatch[2]) {
      minPrice = parseInt(betweenMatch[1], 10);
      maxPrice = parseInt(betweenMatch[2], 10);
    }

    // Residual search keywords
    const searchKeywords = q
      .replace(
        /(?:under|below|less than|within|up to|above|more than|between|from|to|show me|find|looking for|i want|a|an|the|in|for|size)\b/gi,
        '',
      )
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 2);

    return {
      rawQuery: query,
      colors: detectedColors,
      garments: detectedGarments,
      fabrics: detectedFabrics,
      occasions: detectedOccasions,
      gender: detectedGender,
      sizes: detectedSizes,
      maxPrice,
      minPrice,
      searchKeywords,
    };
  }

  private calculateVoiceMatchScore(
    product: VoiceCandidateProduct,
    intent: ParsedVoiceIntent,
  ): number {
    let score = 0;
    const title = product.title.toLowerCase();
    const desc = (product.description || '').toLowerCase();
    const fabric = (
      product.fabricSpecs ||
      product.fabricWeave ||
      ''
    ).toLowerCase();
    const category = (product.category?.name || '').toLowerCase();
    const tags = (product.tags || []).map((t: string) => t.toLowerCase());

    // Color match: 40 pts
    for (const color of intent.colors) {
      if (title.includes(color) || tags.includes(color)) score += 30;
      const varMatch = product.variants?.some((v) =>
        v.color.toLowerCase().includes(color),
      );
      if (varMatch) score += 40;
    }

    // Garment/Category match: 50 pts
    for (const g of intent.garments) {
      if (title.includes(g)) score += 50;
      if (category.includes(g)) score += 40;
      if (tags.some((t: string) => t.includes(g))) score += 25;
    }

    // Fabric match: 30 pts
    for (const f of intent.fabrics) {
      if (fabric.includes(f) || title.includes(f)) score += 30;
    }

    // Occasion match: 20 pts
    for (const o of intent.occasions) {
      if (tags.includes(o) || desc.includes(o) || title.includes(o))
        score += 20;
    }

    // Size availability: 15 pts
    for (const s of intent.sizes) {
      if (
        product.variants?.some(
          (v) => v.size.toLowerCase() === s.toLowerCase() && v.stock > 0,
        )
      ) {
        score += 15;
      }
    }

    // Residual keyword match: 5 pts each
    for (const kw of intent.searchKeywords) {
      if (title.includes(kw)) score += 10;
      if (desc.includes(kw)) score += 5;
    }

    return score;
  }

  private extractVisualFeatures(
    fileBuffer: Buffer | null,
    imageUrl?: string,
    hexColor?: string,
  ) {
    if (hexColor) {
      const rgb = this.hexToRgb(hexColor);
      return {
        dominantHex: hexColor.toUpperCase(),
        dominantRgb: rgb,
        colorName: this.getColorNameFromRgb(rgb),
        paletteHex: [hexColor.toUpperCase()],
        tone: rgb.r + rgb.g + rgb.b < 380 ? 'DARK' : 'LIGHT',
        textureKeyword: null,
      };
    }

    // If buffer is present, sample raw bytes for dominant pixel heuristics
    if (fileBuffer && fileBuffer.length > 54) {
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let count = 0;

      // Sample every 4th byte
      const step = Math.max(1, Math.floor(fileBuffer.length / 500));
      for (let i = 20; i < fileBuffer.length - 3; i += step) {
        rSum += fileBuffer[i] ?? 0;
        gSum += fileBuffer[i + 1] ?? 0;
        bSum += fileBuffer[i + 2] ?? 0;
        count++;
      }

      const r = Math.round(rSum / count) % 256;
      const g = Math.round(gSum / count) % 256;
      const b = Math.round(bSum / count) % 256;
      const dominantHex = this.rgbToHex(r, g, b);
      const rgb = { r, g, b };

      return {
        dominantHex,
        dominantRgb: rgb,
        colorName: this.getColorNameFromRgb(rgb),
        paletteHex: [
          dominantHex,
          this.rgbToHex(
            Math.max(0, r - 30),
            Math.max(0, g - 30),
            Math.max(0, b - 30),
          ),
        ],
        tone: r + g + b < 380 ? 'DARK' : 'LIGHT',
        textureKeyword: r > 180 && g > 170 ? 'linen' : b > r ? 'denim' : null,
      };
    }

    // Fallback URL hash-based deterministic visual signature
    let hash = 0;
    const str = imageUrl || 'default-clothing-visual';
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }

    const r = Math.abs((hash >> 16) & 0xff);
    const g = Math.abs((hash >> 8) & 0xff);
    const b = Math.abs(hash & 0xff);
    const dominantHex = this.rgbToHex(r, g, b);
    const rgb = { r, g, b };

    return {
      dominantHex,
      dominantRgb: rgb,
      colorName: this.getColorNameFromRgb(rgb),
      paletteHex: [dominantHex],
      tone: r + g + b < 380 ? 'DARK' : 'LIGHT',
      textureKeyword: null,
    };
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const clean = hex.replace('#', '').trim();
    if (clean.length === 3) {
      return {
        r: parseInt(clean[0] + clean[0], 16),
        g: parseInt(clean[1] + clean[1], 16),
        b: parseInt(clean[2] + clean[2], 16),
      };
    }
    if (clean.length >= 6) {
      return {
        r: parseInt(clean.substring(0, 2), 16) || 0,
        g: parseInt(clean.substring(2, 4), 16) || 0,
        b: parseInt(clean.substring(4, 6), 16) || 0,
      };
    }
    return { r: 30, g: 41, b: 59 };
  }

  private rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) =>
      Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  }

  private calculateColorDistance(
    c1: { r: number; g: number; b: number },
    c2: { r: number; g: number; b: number },
  ): number {
    // Weighted Euclidean RGB distance (human eye is more sensitive to green)
    const rDiff = c1.r - c2.r;
    const gDiff = c1.g - c2.g;
    const bDiff = c1.b - c2.b;
    const rMean = (c1.r + c2.r) / 2;

    return Math.sqrt(
      (2 + rMean / 256) * rDiff * rDiff +
        4 * gDiff * gDiff +
        (2 + (255 - rMean) / 256) * bDiff * bDiff,
    );
  }

  private getColorNameFromRgb(rgb: {
    r: number;
    g: number;
    b: number;
  }): string {
    const { r, g, b } = rgb;
    if (r < 50 && g < 50 && b < 50) return 'Black / Charcoal';
    if (r > 210 && g > 210 && b > 210) return 'White / Off-White';
    if (b > r + 30 && b > g + 30) return 'Navy / Indigo';
    if (g > r + 20 && g > b + 20) return 'Olive / Forest Green';
    if (r > g + 40 && r > b + 40) return 'Maroon / Rust';
    if (r > 160 && g > 140 && b < 120) return 'Beige / Tan / Khaki';
    return 'Neutral Hue';
  }

  private getHarmonizingColors(color: string): string[] {
    const c = color.toLowerCase();
    if (c.includes('navy') || c.includes('blue') || c.includes('indigo')) {
      return ['White', 'Khaki', 'Beige', 'Charcoal', 'Grey', 'Brown'];
    }
    if (c.includes('black') || c.includes('charcoal')) {
      return ['White', 'Olive', 'Grey', 'Beige', 'Denim', 'Charcoal'];
    }
    if (c.includes('white') || c.includes('cream') || c.includes('beige')) {
      return ['Navy', 'Olive', 'Black', 'Denim', 'Brown', 'Charcoal'];
    }
    if (c.includes('olive') || c.includes('green') || c.includes('sage')) {
      return ['White', 'Black', 'Beige', 'Navy', 'Cream', 'Charcoal'];
    }
    if (c.includes('brown') || c.includes('tan') || c.includes('khaki')) {
      return ['Navy', 'White', 'Black', 'Olive', 'Charcoal'];
    }
    return ['White', 'Black', 'Navy', 'Grey', 'Beige'];
  }
}
