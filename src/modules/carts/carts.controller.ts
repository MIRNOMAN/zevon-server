import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
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
import { CartsService } from './carts.service.js';
import { AddToCartDto, UpdateCartItemDto, SyncCartDto } from './dto/index.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@ApiTags('Shopping Cart')
@ApiBearerAuth('JWT-auth')
@Controller('carts')
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  @Get()
  @ResponseMessage('Cart retrieved successfully')
  @ApiOperation({
    summary:
      'Get customer shopping cart with real-time stock and subtotal calculation (Authenticated Customer)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Cart with detailed line items, unit prices, subtotal, and stock availability',
  })
  getCart(@CurrentUser('userId') userId: string) {
    return this.cartsService.getCart(userId);
  }

  @Post('items')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Item added to cart successfully')
  @ApiOperation({
    summary:
      'Add product variant (SKU/Color/Size) to shopping cart (Authenticated Customer)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Item added and updated cart returned',
  })
  addItem(
    @CurrentUser('userId') userId: string,
    @Body() addToCartDto: AddToCartDto,
  ) {
    return this.cartsService.addItem(userId, addToCartDto);
  }

  @Patch('items/:cartItemId')
  @ResponseMessage('Cart item quantity updated')
  @ApiOperation({
    summary:
      'Update line item quantity in shopping cart (Authenticated Customer)',
  })
  updateItem(
    @CurrentUser('userId') userId: string,
    @Param('cartItemId') cartItemId: string,
    @Body() updateCartItemDto: UpdateCartItemDto,
  ) {
    return this.cartsService.updateItem(userId, cartItemId, updateCartItemDto);
  }

  @Delete('items/:cartItemId')
  @ResponseMessage('Item removed from cart')
  @ApiOperation({
    summary: 'Remove line item from shopping cart (Authenticated Customer)',
  })
  removeItem(
    @CurrentUser('userId') userId: string,
    @Param('cartItemId') cartItemId: string,
  ) {
    return this.cartsService.removeItem(userId, cartItemId);
  }

  @Delete('clear')
  @ResponseMessage('Cart cleared successfully')
  @ApiOperation({
    summary: 'Clear all items from shopping cart (Authenticated Customer)',
  })
  clearCart(@CurrentUser('userId') userId: string) {
    return this.cartsService.clearCart(userId);
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Guest cart synchronized successfully')
  @ApiOperation({
    summary:
      'Merge guest cart items into database cart after customer login/register',
  })
  syncCart(
    @CurrentUser('userId') userId: string,
    @Body() syncCartDto: SyncCartDto,
  ) {
    return this.cartsService.syncCart(userId, syncCartDto);
  }
}
