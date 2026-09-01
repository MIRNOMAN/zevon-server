import { Module } from '@nestjs/common';
import { ReferralsController } from './referrals.controller.js';
import { ReferralsService } from './referrals.service.js';
import { DatabaseModule } from '../../database/database.module.js';
import { MailModule } from '../mail/mail.module.js';
import { LoyaltyModule } from '../loyalty/loyalty.module.js';

@Module({
  imports: [DatabaseModule, MailModule, LoyaltyModule],
  controllers: [ReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
