import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { PdfInvoiceService } from './services/pdf-invoice.service.js';
import { ShippingLabelService } from './services/shipping-label.service.js';
import { DatabaseModule } from '../../database/database.module.js';
import { ShippingModule } from '../shipping/shipping.module.js';
import { CouponsModule } from '../coupons/coupons.module.js';

@Module({
  imports: [DatabaseModule, ShippingModule, CouponsModule],
  controllers: [OrdersController],
  providers: [OrdersService, PdfInvoiceService, ShippingLabelService],
  exports: [OrdersService, PdfInvoiceService, ShippingLabelService],
})
export class OrdersModule {}
