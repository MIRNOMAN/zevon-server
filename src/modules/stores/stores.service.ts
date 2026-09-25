import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

export class CreateStoreDto {
  name!: string;
  address!: string;
  city!: string;
  phone?: string;
  email?: string;
  openingHours?: string;
  latitude?: number;
  longitude?: number;
  googleMapsUrl?: string;
  isActive?: boolean;
}

export class UpdateStoreDto {
  name?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  openingHours?: string;
  latitude?: number;
  longitude?: number;
  googleMapsUrl?: string;
  isActive?: boolean;
}

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public: Get all active store locations (seeds default flagship locations if none exist)
   */
  async findAll() {
    let stores = await (this.prisma as any).storeLocation.findMany({
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

      await (this.prisma as any).storeLocation.createMany({
        data: defaultStores,
      });

      stores = await (this.prisma as any).storeLocation.findMany({
        orderBy: { createdAt: 'asc' },
      });
    }

    return stores;
  }

  /**
   * View single store details
   */
  async findOne(id: string) {
    const store = await (this.prisma as any).storeLocation.findUnique({
      where: { id },
    });

    if (!store) {
      throw new NotFoundException(`Store location with ID "${id}" not found`);
    }

    return store;
  }

  /**
   * Create new physical store location (Admin/Manager)
   */
  async create(dto: CreateStoreDto) {
    return (this.prisma as any).storeLocation.create({
      data: {
        name: dto.name.trim(),
        address: dto.address.trim(),
        city: dto.city.trim(),
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim() || null,
        openingHours: dto.openingHours?.trim() || 'Mon – Sun: 10:00 AM – 10:00 PM BST',
        latitude: dto.latitude ? Number(dto.latitude) : null,
        longitude: dto.longitude ? Number(dto.longitude) : null,
        googleMapsUrl:
          dto.googleMapsUrl?.trim() ||
          `https://maps.google.com/?q=${encodeURIComponent(`${dto.name} ${dto.city}`)}`,
        isActive: dto.isActive ?? true,
      },
    });
  }

  /**
   * Update physical store location (Admin/Manager)
   */
  async update(id: string, dto: UpdateStoreDto) {
    await this.findOne(id);

    return (this.prisma as any).storeLocation.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.address !== undefined ? { address: dto.address.trim() } : {}),
        ...(dto.city !== undefined ? { city: dto.city.trim() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
        ...(dto.email !== undefined ? { email: dto.email.trim() } : {}),
        ...(dto.openingHours !== undefined ? { openingHours: dto.openingHours.trim() } : {}),
        ...(dto.latitude !== undefined ? { latitude: Number(dto.latitude) } : {}),
        ...(dto.longitude !== undefined ? { longitude: Number(dto.longitude) } : {}),
        ...(dto.googleMapsUrl !== undefined ? { googleMapsUrl: dto.googleMapsUrl.trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  /**
   * Delete physical store location (Admin/Manager)
   */
  async remove(id: string) {
    await this.findOne(id);

    await (this.prisma as any).storeLocation.delete({
      where: { id },
    });

    return { success: true, message: 'Store location deleted successfully' };
  }
}
