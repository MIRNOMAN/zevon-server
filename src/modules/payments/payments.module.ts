import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { DatabaseModule } from '../../database/database.module.js';
import { MailModule } from '../mail/mail.module.js';

@Module({
  imports: [DatabaseModule, MailModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
