import { Module } from '@nestjs/common';
import { GiftCardsController } from './gift-cards.controller.js';
import { GiftCardsService } from './gift-cards.service.js';
import { DatabaseModule } from '../../database/database.module.js';
import { MailModule } from '../mail/mail.module.js';

@Module({
  imports: [DatabaseModule, MailModule],
  controllers: [GiftCardsController],
  providers: [GiftCardsService],
  exports: [GiftCardsService],
})
export class GiftCardsModule {}
