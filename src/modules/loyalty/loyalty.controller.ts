import {
  Controller,
  Get,
  Post,
  Body,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { LoyaltyService } from './loyalty.service.js';
import { RedeemPointsDto, AdjustPointsDto } from './dto/index.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@ApiTags('Tiered Loyalty & Rewards Wallet')
@ApiBearerAuth('JWT-auth')
@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('my-account')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Loyalty account retrieved successfully')
  @ApiOperation({
    summary:
      'Get customer loyalty wallet balance, tier (Bronze, Silver, Gold, Platinum), and points ledger',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Returns points balance, BDT cash value, tier perks, and transaction history',
  })
  getMyAccount(@CurrentUser('userId') userId: string) {
    return this.loyaltyService.getAccount(userId);
  }

  @Post('redeem')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Points redeemed for checkout discount successfully')
  @ApiOperation({
    summary:
      'Redeem loyalty points for discount at checkout (1 point = ৳1 BDT)',
  })
  redeemPoints(
    @CurrentUser('userId') userId: string,
    @Body() dto: RedeemPointsDto,
  ) {
    return this.loyaltyService.redeemPoints(userId, dto.points, dto.orderId);
  }

  @Post('admin/adjust')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Loyalty points adjusted successfully')
  @ApiOperation({
    summary:
      'Manually credit/debit loyalty points for a user with audit reason (Admin only)',
  })
  adjustPoints(
    @CurrentUser('userId') adminUserId: string,
    @Body() dto: AdjustPointsDto,
  ) {
    return this.loyaltyService.adjustPoints(adminUserId, dto);
  }
}
