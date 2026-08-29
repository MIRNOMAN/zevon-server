import { Module } from '@nestjs/common';
import { BannersService } from './banners.service.js';
import { BannersController } from './banners.controller.js';

@Module({
  controllers: [BannersController],
  providers: [BannersService],
  exports: [BannersService],
})
export class BannersModule {}
