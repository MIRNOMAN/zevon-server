import { Module } from '@nestjs/common';
import { LookbooksService } from './lookbooks.service.js';
import { LookbooksController } from './lookbooks.controller.js';

@Module({
  controllers: [LookbooksController],
  providers: [LookbooksService],
  exports: [LookbooksService],
})
export class LookbooksModule {}
