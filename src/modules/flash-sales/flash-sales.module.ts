import { Module } from '@nestjs/common';
import { FlashSalesService } from './flash-sales.service.js';
import { FlashSalesController } from './flash-sales.controller.js';

@Module({
  controllers: [FlashSalesController],
  providers: [FlashSalesService],
  exports: [FlashSalesService],
})
export class FlashSalesModule {}
