import { Module } from '@nestjs/common';
import { ShippingController } from './shipping.controller.js';
import { ShippingService } from './shipping.service.js';
import { DatabaseModule } from '../../database/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [ShippingController],
  providers: [ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
