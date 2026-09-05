import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class SustainabilityService {
  constructor(private readonly prisma: PrismaService) {}

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
}
