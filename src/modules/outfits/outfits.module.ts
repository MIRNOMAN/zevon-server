import { Module } from '@nestjs/common';
import { OutfitsService } from './outfits.service.js';
import { OutfitsController } from './outfits.controller.js';

@Module({
  controllers: [OutfitsController],
  providers: [OutfitsService],
  exports: [OutfitsService],
})
export class OutfitsModule {}
