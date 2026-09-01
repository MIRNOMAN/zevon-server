import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service.js';
import {
  CheckoutDto,
  UpdateOrderStatusDto,
  UpdatePaymentStatusDto,
  OrderQueryDto,
  TrackOrderDto,
} from './dto/index.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';

@ApiTags('Orders & Atomic Checkout')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ── Public Order Tracking ──────────────────────────────────────────────

  @Post('track')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Order tracking details retrieved successfully')
  @ApiOperation({
    summary:
      'Public Order Tracking: Lookup by orderNumber and email/phone, returning shipment stepper states and live status',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Returns shipment milestone stepper (Pending -> Confirmed -> Processing -> Shipped -> Delivered), courier info, and return eligibility',
  })
  trackOrder(@Body() trackOrderDto: TrackOrderDto) {
    return this.ordersService.trackOrder(trackOrderDto);
  }

  // ── Customer Checkout & Order Placement ────────────────────────────────

  @Post('checkout')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Order placed successfully')
  @ApiOperation({
    summary:
      'Atomic checkout & order placement with live stock locking, coupon application, address snapshot, and cart cleanup',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description:
      'Order created successfully within an atomic transaction. Inventory decremented and cart cleared.',
  })
  checkout(
    @CurrentUser('userId') userId: string,
    @Body() checkoutDto: CheckoutDto,
  ) {
    return this.ordersService.checkout(userId, checkoutDto);
  }

  @Get('my-orders')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Customer orders retrieved successfully')
  @ApiOperation({
    summary: 'Get paginated order history for the authenticated customer',
  })
  findMyOrders(
    @CurrentUser('userId') userId: string,
    @Query() query: OrderQueryDto,
  ) {
    return this.ordersService.findMyOrders(userId, query);
  }

  @Get('my-orders/:id')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Customer order retrieved successfully')
  @ApiOperation({
    summary: 'Get detailed order information for customer',
  })
  findMyOrderById(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.ordersService.findMyOrderById(userId, id);
  }

  @Patch('my-orders/:id/cancel')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Order cancelled successfully')
  @ApiOperation({
    summary:
      'Cancel a pending order by customer (restores inventory and coupon usage)',
  })
  cancelMyOrder(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.ordersService.cancelMyOrder(userId, id);
  }

  // ── Admin & Manager Order Management (RBAC) ────────────────────────────

  @Get('metrics/summary')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Orders metrics summary retrieved successfully')
  @ApiOperation({
    summary: 'Get sales and order metrics summary (Admin/Manager)',
  })
  getMetricsSummary() {
    return this.ordersService.getMetricsSummary();
  }

  @Get()
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Orders retrieved successfully')
  @ApiOperation({
    summary: 'List all store orders with filters, search, and pagination (Admin/Manager)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  findAll(@Query() query: OrderQueryDto) {
    return this.ordersService.findAll(query);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Order details retrieved successfully')
  @ApiOperation({
    summary: 'Get full order details by ID (Admin/Manager)',
  })
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Order status updated successfully')
  @ApiOperation({
    summary:
      'Update order lifecycle status (e.g. PROCESSING, SHIPPED, DELIVERED, CANCELLED)',
  })
  updateStatus(
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, updateOrderStatusDto);
  }

  @Patch(':id/payment-status')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Order payment status updated successfully')
  @ApiOperation({
    summary: 'Update order payment status (PENDING, PAID, FAILED, REFUNDED)',
  })
  updatePaymentStatus(
    @Param('id') id: string,
    @Body() updatePaymentStatusDto: UpdatePaymentStatusDto,
  ) {
    return this.ordersService.updatePaymentStatus(id, updatePaymentStatusDto);
  }
}
