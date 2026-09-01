import { Module } from '@nestjs/common';
import { AbandonedCartController } from './abandoned-cart.controller.js';
import { AbandonedCartService } from './abandoned-cart.service.js';
import { DatabaseModule } from '../../database/database.module.js';
import { MailModule } from '../mail/mail.module.js';

@Module({
  imports: [DatabaseModule, MailModule],
  controllers: [AbandonedCartController],
  providers: [AbandonedCartService],
  exports: [AbandonedCartService],
})
export class AbandonedCartModule {}
