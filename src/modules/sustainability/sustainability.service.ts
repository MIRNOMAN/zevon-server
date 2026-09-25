import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

export interface SustainabilityMetrics {
  organicSourcingPercent: number;
  organicSourcingDescription: string;
  carbonOffsetPercent: number;
  carbonOffsetDescription: string;
  plasticFreePackagingPercent: number;
  plasticFreePackagingDescription: string;
  waterRecycledPercent: number;
  waterRecycledDescription: string;
  totalGarmentsRecycled: number;
  activeEcoInitiativesCount: number;
  lastUpdated: string;
}

@Injectable()
export class SustainabilityService {
  // Configurable metrics state with defaults
  private metrics: SustainabilityMetrics = {
    organicSourcingPercent: 94.2,
    organicSourcingDescription: 'Certified GOTS organic silk & pure wool',
    carbonOffsetPercent: 100,
    carbonOffsetDescription: 'All DHL Air express dispatches neutralized',
    plasticFreePackagingPercent: 100,
    plasticFreePackagingDescription: 'Biodegradable mulberry paper & cotton garment bags',
    waterRecycledPercent: 85,
    waterRecycledDescription: 'Closed-loop biological effluent water treatment plants',
    totalGarmentsRecycled: 1420,
    activeEcoInitiativesCount: 6,
    lastUpdated: new Date().toISOString(),
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get dynamic sustainability metrics
   */
  async getMetrics(): Promise<SustainabilityMetrics> {
    const storiesCount = await this.prisma.sustainabilityStory.count();
    return {
      ...this.metrics,
      activeEcoInitiativesCount: Math.max(storiesCount, 4),
    };
  }

  /**
   * Update sustainability metrics (Admin/Manager)
   */
  async updateMetrics(dto: Partial<SustainabilityMetrics>): Promise<SustainabilityMetrics> {
    this.metrics = {
      ...this.metrics,
      ...dto,
      lastUpdated: new Date().toISOString(),
    };
    return this.metrics;
  }

  /**
   * Public: Get all published sustainability stories (seeds defaults if none exist)
   */
  async findAll() {
    let stories = await this.prisma.sustainabilityStory.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: 'asc' },
    });

    if (stories.length === 0) {
      const defaultStories = [
        {
          title: '380+ GSM 100% GOTS Certified Organic Cotton',
          slug: 'organic-heavyweight-cotton',
          summary:
            'We engineer our signature heavy fleece and jersey with unblended organic combed cotton sourced from certified sustainable agricultural farms.',
          content:
            'At ZEVON, weight is substance. Our 380–420 GSM textiles are crafted without synthetic fillers or micro-plastics, ensuring garments that retain structure for decades rather than single seasons.',
          coverImageUrl:
            'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?q=80&w=1200&auto=format&fit=crop',
          isPublished: true,
          publishedAt: new Date(),
        },
        {
          title: 'Azo-Free Low Impact Reactive Dyeing',
          slug: 'eco-friendly-reactive-dyes',
          summary:
            'Deep onyx blacks and concrete greys achieved through closed-loop water filtration systems that eliminate hazardous runoffs.',
          content:
            'Traditional garment dyeing consumes enormous water volumes. Our partnered facilities in Gazipur and Narayanganj utilize advanced biological effluent treatment plants (ETP), recycling 85% of process water.',
          coverImageUrl:
            'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?q=80&w=1200&auto=format&fit=crop',
          isPublished: true,
          publishedAt: new Date(),
        },
        {
          title: 'Zero Single-Use Plastic & 100% Biodegradable Packaging',
          slug: 'biodegradable-packaging-initiative',
          summary:
            'From garment dust bags to shipping mailers, our packaging is made from cornstarch and recycled kraft board.',
          content:
            'Every ZEVON archive order is delivered in home-compostable mailers and unbleached paper boxes. Our hangtags are crafted from cotton manufacturing offcuts with zero synthetic laminates.',
          coverImageUrl:
            'https://images.unsplash.com/photo-1605600659873-d808a13e4d2a?q=80&w=1200&auto=format&fit=crop',
          isPublished: true,
          publishedAt: new Date(),
        },
        {
          title: 'Ethical Atelier Craftsmanship & Living Wages',
          slug: 'ethical-atelier-fair-wages',
          summary:
            'We champion generational garment artisans in Bangladesh with 40% above living-wage standards, safe working studios, and comprehensive healthcare.',
          content:
            'Bangladesh has been the garment hub of the world for decades. ZEVON brings pride back to local craftsmanship by creating artisanal-grade small batches, respecting the master tailors behind every stitch.',
          coverImageUrl:
            'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?q=80&w=1200&auto=format&fit=crop',
          isPublished: true,
          publishedAt: new Date(),
        },
      ];

      await this.prisma.sustainabilityStory.createMany({
        data: defaultStories,
      });

      stories = await this.prisma.sustainabilityStory.findMany({
        where: { isPublished: true },
        orderBy: { createdAt: 'asc' },
      });
    }

    return stories;
  }

  /**
   * Admin: Create a new sustainability initiative / story
   */
  async createStory(data: {
    title: string;
    slug?: string;
    summary: string;
    content: string;
    coverImageUrl: string;
    isPublished?: boolean;
  }) {
    const slug =
      data.slug?.trim() ||
      data.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '') + `-${Date.now().toString().slice(-4)}`;

    return this.prisma.sustainabilityStory.create({
      data: {
        title: data.title.trim(),
        slug,
        summary: data.summary.trim(),
        content: data.content.trim(),
        coverImageUrl: data.coverImageUrl.trim(),
        isPublished: data.isPublished ?? true,
        publishedAt: data.isPublished !== false ? new Date() : null,
      },
    });
  }

  /**
   * Admin: Update sustainability story
   */
  async updateStory(
    id: string,
    data: {
      title?: string;
      slug?: string;
      summary?: string;
      content?: string;
      coverImageUrl?: string;
      isPublished?: boolean;
    },
  ) {
    const story = await this.prisma.sustainabilityStory.findUnique({
      where: { id },
    });
    if (!story) {
      throw new NotFoundException(`Sustainability story with ID "${id}" not found`);
    }

    return this.prisma.sustainabilityStory.update({
      where: { id },
      data: {
        ...(data.title ? { title: data.title.trim() } : {}),
        ...(data.slug ? { slug: data.slug.trim() } : {}),
        ...(data.summary ? { summary: data.summary.trim() } : {}),
        ...(data.content ? { content: data.content.trim() } : {}),
        ...(data.coverImageUrl ? { coverImageUrl: data.coverImageUrl.trim() } : {}),
        ...(data.isPublished !== undefined
          ? {
              isPublished: data.isPublished,
              publishedAt: data.isPublished ? new Date() : null,
            }
          : {}),
      },
    });
  }

  /**
   * Admin: Delete sustainability story
   */
  async deleteStory(id: string) {
    const story = await this.prisma.sustainabilityStory.findUnique({
      where: { id },
    });
    if (!story) {
      throw new NotFoundException(`Sustainability story with ID "${id}" not found`);
    }

    await this.prisma.sustainabilityStory.delete({ where: { id } });
    return { success: true, message: 'Sustainability story deleted successfully' };
  }
}
