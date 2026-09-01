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
import { ShippingService } from './shipping.service.js';
import {
  CreateShippingZoneDto,
  UpdateShippingZoneDto,
  CalculateShippingDto,
  ShippingZoneQueryDto,
} from './dto/index.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';

@ApiTags('Shipping Zones & Rates Engine')
@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  // ── Public & Customer Checkout Endpoints ───────────────────────────────

  @Post('calculate')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Shipping rates calculated successfully')
  @ApiOperation({
    summary:
      'Automated shipping rate calculation based on postal code, city, zone rules, and cart subtotal',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Returns matched shipping zone, applicable standard/express delivery rates, free shipping threshold status, and final total',
  })
  calculateShipping(
    @CurrentUser('userId') userId?: string,
    @Body() calculateShippingDto?: CalculateShippingDto,
  ) {
    return this.shippingService.calculateShipping(
      userId,
      calculateShippingDto,
    );
  }

  @Get('public')
  @Public()
  @ResponseMessage('Public shipping zones retrieved successfully')
  @ApiOperation({
    summary:
      'Get active shipping zones with standard rates and delivery timeframes for customer storefront',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Active shipping zones list',
  })
  findAllPublic() {
    return this.shippingService.findAllPublic();
  }

  // ── Admin Shipping Zones Management (RBAC Protected) ───────────────────

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Shipping zone created successfully')
  @ApiOperation({
    summary: 'Create a new shipping zone and rate rules (Admin/Manager)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Shipping zone created successfully',
  })
  create(@Body() createDto: CreateShippingZoneDto) {
    return this.shippingService.create(createDto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Shipping zones retrieved successfully')
  @ApiOperation({
    summary:
      'List all shipping zones with pagination, filters, and order count metrics (Admin/Manager)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(@Query() query: ShippingZoneQueryDto) {
    return this.shippingService.findAll(query);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Shipping zone retrieved successfully')
  @ApiOperation({
    summary: 'Get shipping zone details by ID (Admin/Manager)',
  })
  findOne(@Param('id') id: string) {
    return this.shippingService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Shipping zone updated successfully')
  @ApiOperation({
    summary: 'Update shipping zone parameters and rate rules (Admin/Manager)',
  })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateShippingZoneDto,
  ) {
    return this.shippingService.update(id, updateDto);
  }

  @Patch(':id/toggle-status')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Shipping zone active status toggled successfully')
  @ApiOperation({
    summary: 'Toggle shipping zone active/inactive status (Admin/Manager)',
  })
  toggleStatus(@Param('id') id: string) {
    return this.shippingService.toggleStatus(id);
  }

  @Patch(':id/set-default')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Shipping zone set as default fallback successfully')
  @ApiOperation({
    summary:
      'Set shipping zone as default fallback for unmatched areas (Admin/Manager)',
  })
  setDefault(@Param('id') id: string) {
    return this.shippingService.setDefault(id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Shipping zone deleted successfully')
  @ApiOperation({
    summary:
      'Delete a shipping zone (Admin only, blocked if zone has associated orders)',
  })
  remove(@Param('id') id: string) {
    return this.shippingService.remove(id);
  }
}
