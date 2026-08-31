import { Module } from '@nestjs/common';
import { CartsService } from './carts.service.js';
import { CartsController } from './carts.controller.js';

@Module({
  controllers: [CartsController],
  providers: [CartsService],
  exports: [CartsService],
})
export class CartsModule {}
