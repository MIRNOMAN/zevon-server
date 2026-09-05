import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SustainabilityService } from './sustainability.service.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@ApiTags('Sustainability')
@Controller('sustainability')
export class SustainabilityController {
  constructor(private readonly sustainabilityService: SustainabilityService) {}

  @Public()
  @Get()
  @ResponseMessage('Sustainability stories retrieved successfully')
  @ApiOperation({ summary: 'Get all published sustainability stories and eco commitments (Public)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Sustainability stories returned' })
  findAll() {
    return this.sustainabilityService.findAll();
  }
}
