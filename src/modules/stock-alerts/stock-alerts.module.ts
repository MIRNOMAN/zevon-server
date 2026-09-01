import { Module } from '@nestjs/common';
import { StockAlertsController } from './stock-alerts.controller.js';
import { StockAlertsService } from './stock-alerts.service.js';
import { DatabaseModule } from '../../database/database.module.js';
import { MailModule } from '../mail/mail.module.js';

@Module({
  imports: [DatabaseModule, MailModule],
  controllers: [StockAlertsController],
  providers: [StockAlertsService],
  exports: [StockAlertsService],
})
export class StockAlertsModule {}
