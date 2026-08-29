import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import {
  appConfig,
  databaseConfig,
  jwtConfig,
  validateEnv,
} from './config/index.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { AddressesModule } from './modules/addresses/addresses.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';

@Module({
  imports: [
    // ── Configuration ────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig],
      validate: validateEnv,
    }),

    // ── Database ─────────────────────────────────────────────────
    DatabaseModule,

    // ── Feature Modules ──────────────────────────────────────────
    AuthModule,
    UsersModule,
    AddressesModule,
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
