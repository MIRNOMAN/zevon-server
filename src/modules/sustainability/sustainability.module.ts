import { Module } from '@nestjs/common';
import { SustainabilityController } from './sustainability.controller.js';
import { SustainabilityService } from './sustainability.service.js';

@Module({
  controllers: [SustainabilityController],
  providers: [SustainabilityService],
  exports: [SustainabilityService],
})
export class SustainabilityModule {}
