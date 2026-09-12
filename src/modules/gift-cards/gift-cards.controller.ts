import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { GiftCardsService } from './gift-cards.service.js';
import {
  PurchaseGiftCardDto,
  CreateGiftCardDto,
  UpdateGiftCardDto,
  CheckBalanceDto,
  RedeemGiftCardDto,
  GiftCardQueryDto,
} from './dto/index.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';

@ApiTags('Digital Gift Cards')
@Controller('gift-cards')
export class GiftCardsController {
  constructor(private readonly giftCardsService: GiftCardsService) {}

  @Post('purchase')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Digital gift card purchased and delivered successfully')
  @ApiOperation({
    summary:
      'Purchase digital gift card with custom amount and personalized recipient email delivery',
  })
  purchase(
    @CurrentUser('userId') userId: string,
    @Body() dto: PurchaseGiftCardDto,
  ) {
    return this.giftCardsService.purchase(userId, dto);
  }

  @Post('check-balance')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Gift card balance retrieved successfully')
  @ApiOperation({
    summary: 'Check remaining balance and validity of a gift card voucher code',
  })
  checkBalance(@Body() dto: CheckBalanceDto) {
    return this.giftCardsService.checkBalance(dto);
  }

  @Post('redeem')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Gift card redeemed successfully')
  @ApiOperation({
    summary: 'Redeem / deduct balance from gift card voucher towards an order',
  })
  redeem(
    @CurrentUser('userId') userId: string,
    @Body() dto: RedeemGiftCardDto,
  ) {
    return this.giftCardsService.redeem(userId, dto);
  }

  // ──────────────────────────────────────────────────────────────
  // ADMIN & MANAGER MANAGEMENT ENDPOINTS
  // ──────────────────────────────────────────────────────────────

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Gift card issued successfully')
  @ApiOperation({
    summary: 'Directly issue a digital gift card (Admin/Manager)',
  })
  create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateGiftCardDto,
  ) {
    return this.giftCardsService.create(userId, dto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Gift cards list retrieved successfully')
  @ApiOperation({
    summary: 'List all digital gift cards (Admin/Manager)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  findAll(@Query() query: GiftCardQueryDto) {
    return this.giftCardsService.findAll(query);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Gift card details retrieved successfully')
  @ApiOperation({
    summary: 'Get single gift card by ID with redemption logs (Admin/Manager)',
  })
  @ApiParam({ name: 'id', description: 'Gift card ID' })
  findOne(@Param('id') id: string) {
    return this.giftCardsService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Gift card updated successfully')
  @ApiOperation({
    summary: 'Update gift card details (Admin/Manager)',
  })
  @ApiParam({ name: 'id', description: 'Gift card ID' })
  update(@Param('id') id: string, @Body() dto: UpdateGiftCardDto) {
    return this.giftCardsService.update(id, dto);
  }

  @Patch(':id/toggle')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Gift card status toggled successfully')
  @ApiOperation({
    summary: 'Toggle gift card ACTIVE / DISABLED status (Admin/Manager)',
  })
  @ApiParam({ name: 'id', description: 'Gift card ID' })
  toggleStatus(@Param('id') id: string) {
    return this.giftCardsService.toggleStatus(id);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Gift card deleted successfully')
  @ApiOperation({
    summary: 'Delete a gift card (Admin/Manager)',
  })
  @ApiParam({ name: 'id', description: 'Gift card ID' })
  remove(@Param('id') id: string) {
    return this.giftCardsService.remove(id);
  }
}
