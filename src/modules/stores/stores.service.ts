import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public: Get all active store locations (seeds default flagship locations if none exist)
   */
  async findAll() {
    let stores = await this.prisma.storeLocation.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (stores.length === 0) {
      const defaultStores = [
        {
          name: 'ZEVON Flagship Atelier — Banani',
          address: 'House 42, Road 11, Block D, Banani',
          city: 'Dhaka',
          phone: '+880 1700-000001',
          email: 'banani@zevon.com',
          openingHours: 'Mon – Sun: 10:00 AM – 10:00 PM BST',
          latitude: 23.7937,
          longitude: 90.4043,
          googleMapsUrl: 'https://maps.google.com/?q=Banani+Dhaka',
          isActive: true,
        },
        {
          name: 'ZEVON Studio Lounge — Gulshan 2',
          address: 'Avenue 5, Gulshan 2 (Opposite Westin)',
          city: 'Dhaka',
          phone: '+880 1700-000002',
          email: 'gulshan@zevon.com',
          openingHours: 'Mon – Sun: 11:00 AM – 10:30 PM BST',
          latitude: 23.7925,
          longitude: 90.4167,
          googleMapsUrl: 'https://maps.google.com/?q=Gulshan+2+Dhaka',
          isActive: true,
        },
        {
          name: 'ZEVON Concept Space — Dhanmondi',
          address: 'House 14, Road 27 (Old), Dhanmondi',
          city: 'Dhaka',
          phone: '+880 1700-000003',
          email: 'dhanmondi@zevon.com',
          openingHours: 'Mon – Sun: 10:30 AM – 09:30 PM BST',
          latitude: 23.7533,
          longitude: 90.3769,
          googleMapsUrl: 'https://maps.google.com/?q=Dhanmondi+27+Dhaka',
          isActive: true,
        },
        {
          name: 'ZEVON Archive Pop-Up — Chattogram',
          address: 'GEC Circle, Nasirabad, Chattogram',
          city: 'Chattogram',
          phone: '+880 1700-000004',
          email: 'chattogram@zevon.com',
          openingHours: 'Mon – Sun: 11:00 AM – 09:00 PM BST',
          latitude: 22.3569,
          longitude: 91.7832,
          googleMapsUrl: 'https://maps.google.com/?q=GEC+Circle+Chattogram',
          isActive: true,
        },
      ];

      await this.prisma.storeLocation.createMany({
        data: defaultStores,
      });

      stores = await this.prisma.storeLocation.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });
    }

    return stores;
  }
}
