import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
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
import { CouponsService } from './coupons.service.js';
import {
  ValidateCouponDto,
  CreateCouponDto,
  UpdateCouponDto,
} from './dto/index.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@ApiTags('Coupons & Cart Rules')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  // ── Customer Checkout Endpoint ───────────────────────────────

  @Post('validate')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Coupon validated successfully')
  @ApiOperation({
    summary:
      'Validate promo coupon code against current cart rules (Authenticated Customer)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Validates minimum order spend, date validity, usage limit, and single per-user usage, returning calculated discount amount',
  })
  validateCoupon(
    @CurrentUser('userId') userId: string,
    @Body() validateCouponDto: ValidateCouponDto,
  ) {
    return this.couponsService.validateCoupon(userId, validateCouponDto);
  }

  // ── Admin Coupon Management (RBAC Protected) ─────────────────

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Coupon created successfully')
  @ApiOperation({
    summary: 'Create a new promotional coupon / cart rule (Admin/Manager)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Coupon created successfully',
  })
  create(@Body() createCouponDto: CreateCouponDto) {
    return this.couponsService.create(createCouponDto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Coupons retrieved successfully')
  @ApiOperation({
    summary: 'List all promotional coupons with metrics (Admin/Manager)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const activeBool = isActive !== undefined ? isActive === 'true' : undefined;

    return this.couponsService.findAll(pageNum, limitNum, activeBool, search);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Coupon retrieved successfully')
  @ApiOperation({ summary: 'Get coupon details by ID (Admin/Manager)' })
  findOne(@Param('id') id: string) {
    return this.couponsService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Coupon updated successfully')
  @ApiOperation({ summary: 'Update coupon configuration (Admin/Manager)' })
  update(@Param('id') id: string, @Body() updateCouponDto: UpdateCouponDto) {
    return this.couponsService.update(id, updateCouponDto);
  }

  @Patch(':id/toggle-status')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Coupon status toggled successfully')
  @ApiOperation({ summary: 'Toggle coupon active status (Admin/Manager)' })
  toggleStatus(@Param('id') id: string) {
    return this.couponsService.toggleStatus(id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Coupon deleted successfully')
  @ApiOperation({ summary: 'Delete a coupon (Admin only)' })
  remove(@Param('id') id: string) {
    return this.couponsService.remove(id);
  }
}
