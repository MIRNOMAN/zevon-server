import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { WishlistsService } from './wishlists.service.js';
import { ToggleWishlistDto } from './dto/index.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@ApiTags('Wishlist')
@ApiBearerAuth('JWT-auth')
@Controller('wishlists')
export class WishlistsController {
  constructor(private readonly wishlistsService: WishlistsService) {}

  @Post('toggle')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Wishlist item toggled successfully')
  @ApiOperation({
    summary:
      'Toggle add or remove a product in customer wishlist (Authenticated Customer)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns inWishlist status: true (added) or false (removed)',
  })
  toggle(
    @CurrentUser('userId') userId: string,
    @Body() toggleWishlistDto: ToggleWishlistDto,
  ) {
    return this.wishlistsService.toggle(userId, toggleWishlistDto.productId);
  }

  @Get()
  @ResponseMessage('Wishlist retrieved successfully')
  @ApiOperation({
    summary:
      'Get customer wishlist with product cards and live stock (Authenticated Customer)',
  })
  findAll(@CurrentUser('userId') userId: string) {
    return this.wishlistsService.findAll(userId);
  }

  @Get('check/:productId')
  @ResponseMessage('Wishlist status checked')
  @ApiOperation({
    summary:
      'Check if specific product is already in user wishlist (Authenticated Customer)',
  })
  check(
    @CurrentUser('userId') userId: string,
    @Param('productId') productId: string,
  ) {
    return this.wishlistsService.check(userId, productId);
  }

  @Delete()
  @ResponseMessage('Wishlist cleared successfully')
  @ApiOperation({
    summary: 'Clear all items from customer wishlist (Authenticated Customer)',
  })
  clear(@CurrentUser('userId') userId: string) {
    return this.wishlistsService.clear(userId);
  }
}
