import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { StoresService } from './stores.service.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@ApiTags('Store Locations')
@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Public()
  @Get()
  @ResponseMessage('Store locations retrieved successfully')
  @ApiOperation({ summary: 'Get all active store locations and flagship studios (Public)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Store locations returned' })
  findAll() {
    return this.storesService.findAll();
  }
}
