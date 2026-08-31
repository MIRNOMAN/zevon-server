import { Module } from '@nestjs/common';
import { CouponsService } from './coupons.service.js';
import { CouponsController } from './coupons.controller.js';

@Module({
  controllers: [CouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
