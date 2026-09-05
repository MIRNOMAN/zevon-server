import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import {
  appConfig,
  databaseConfig,
  jwtConfig,
  stripeConfig,
  mailConfig,
  validateEnv,
} from './config/index.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { AddressesModule } from './modules/addresses/addresses.module.js';
import { BannersModule } from './modules/banners/banners.module.js';
import { LookbooksModule } from './modules/lookbooks/lookbooks.module.js';
import { FlashSalesModule } from './modules/flash-sales/flash-sales.module.js';
import { CategoriesModule } from './modules/categories/categories.module.js';
import { ProductsModule } from './modules/products/products.module.js';
import { WishlistsModule } from './modules/wishlists/wishlists.module.js';
import { CartsModule } from './modules/carts/carts.module.js';
import { ReviewsModule } from './modules/reviews/reviews.module.js';
import { CouponsModule } from './modules/coupons/coupons.module.js';
import { ShippingModule } from './modules/shipping/shipping.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { MailModule } from './modules/mail/mail.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { ReturnsModule } from './modules/returns/returns.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { StockAlertsModule } from './modules/stock-alerts/stock-alerts.module.js';
import { CurrencyModule } from './modules/currency/currency.module.js';
import { RecommendationsModule } from './modules/recommendations/recommendations.module.js';
import { LoyaltyModule } from './modules/loyalty/loyalty.module.js';
import { ReferralsModule } from './modules/referrals/referrals.module.js';
import { AbandonedCartModule } from './modules/abandoned-cart/abandoned-cart.module.js';
import { GiftCardsModule } from './modules/gift-cards/gift-cards.module.js';
import { OutfitsModule } from './modules/outfits/outfits.module.js';
import { SearchModule } from './modules/search/search.module.js';
import { ChatModule } from './modules/chat/chat.module.js';
import { ContactModule } from './modules/contact/contact.module.js';
import { StoresModule } from './modules/stores/stores.module.js';
import { SustainabilityModule } from './modules/sustainability/sustainability.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';

@Module({
  imports: [
    // ── Configuration ────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, stripeConfig, mailConfig],
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),

    // ── Database ─────────────────────────────────────────────────
    DatabaseModule,

    // ── Feature Modules ──────────────────────────────────────────
    AuthModule,
    UsersModule,
    AddressesModule,
    BannersModule,
    LookbooksModule,
    FlashSalesModule,
    CategoriesModule,
    ProductsModule,
    WishlistsModule,
    CartsModule,
    ReviewsModule,
    CouponsModule,
    ShippingModule,
    OrdersModule,
    MailModule,
    PaymentsModule,
    ReturnsModule,
    AnalyticsModule,
    StockAlertsModule,
    CurrencyModule,
    RecommendationsModule,
    LoyaltyModule,
    ReferralsModule,
    AbandonedCartModule,
    GiftCardsModule,
    OutfitsModule,
    SearchModule,
    ChatModule,
    ContactModule,
    StoresModule,
    SustainabilityModule,
  ],
  providers: [
    // 1. Global JWT guard — all routes are protected unless decorated with @Public()
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // 2. Global Roles guard — verifies user role permissions against @Roles(...) metadata
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
