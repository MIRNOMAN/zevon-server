import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

export interface StoreSettings {
  storeBrandName: string;
  supportEmail: string;
  supportPhone: string;
  address: string;
  defaultCurrency: string;
  freeShippingThreshold: number;
  taxRatePercent: number;
  enableStockAlerts: boolean;
  enableGuestCheckout: boolean;
  metaTitle: string;
  metaDescription: string;
  updatedAt: string;
}

@Injectable()
export class SettingsService {
  private settings: StoreSettings = {
    storeBrandName: 'ZEVON Luxury Retail',
    supportEmail: 'concierge@zevon.com',
    supportPhone: '+1 (800) 555-ZEVON',
    address: 'Avenue Montaigne, 75008 Paris, France',
    defaultCurrency: 'USD',
    freeShippingThreshold: 500,
    taxRatePercent: 0,
    enableStockAlerts: true,
    enableGuestCheckout: true,
    metaTitle: 'ZEVON | Haute Couture & Luxury Streetwear',
    metaDescription: 'Discover the latest haute couture, heavy fleece archives, and avant-garde luxury apparel.',
    updatedAt: new Date().toISOString(),
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieve store settings
   */
  async getSettings(): Promise<StoreSettings> {
    return this.settings;
  }

  /**
   * Update store settings (Admin/Manager only)
   */
  async updateSettings(dto: Partial<StoreSettings>): Promise<StoreSettings> {
    this.settings = {
      ...this.settings,
      ...dto,
      updatedAt: new Date().toISOString(),
    };
    return this.settings;
  }
}
