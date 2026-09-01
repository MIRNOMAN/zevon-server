import { Controller, Get, Post, HttpStatus, HttpCode } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { AbandonedCartService } from './abandoned-cart.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@ApiTags('Automated Abandoned Cart Recovery')
@ApiBearerAuth('JWT-auth')
@Controller('abandoned-carts')
export class AbandonedCartController {
  constructor(private readonly abandonedCartService: AbandonedCartService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Abandoned carts list retrieved successfully')
  @ApiOperation({
    summary: 'List active abandoned shopping carts (Admin/Manager)',
  })
  getAbandonedCarts() {
    return this.abandonedCartService.getAbandonedCartsList();
  }

  @Post('trigger-recovery')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Abandoned cart recovery scan triggered successfully')
  @ApiOperation({
    summary:
      'Manually trigger abandoned cart recovery scanner and email dispatches (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Scans for carts abandoned in last 2-48h and sends dynamic promo recovery emails',
  })
  triggerRecovery() {
    return this.abandonedCartService.scanAndRecoverAbandonedCarts();
  }
}
