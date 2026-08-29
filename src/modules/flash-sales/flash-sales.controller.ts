import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { FlashSalesService } from './flash-sales.service.js';
import {
  CreateFlashSaleDto,
  UpdateFlashSaleDto,
  ClaimStockDto,
} from './dto/index.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@ApiTags('Flash Sale & Tiered Deal Campaigns')
@Controller('flash-sales')
export class FlashSalesController {
  constructor(private readonly flashSalesService: FlashSalesService) {}

  // ── Public Campaign Endpoints ────────────────────────────────

  @Public()
  @Get('active')
  @ResponseMessage('Active flash sale fetched successfully')
  @ApiOperation({
    summary:
      'Get currently active LIVE flash sale with countdown timer & stock claim progress (Public)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Live flash sale with countdown metadata and real-time claim percentages',
  })
  getActiveFlashSale() {
    return this.flashSalesService.getActiveFlashSale();
  }

  @Public()
  @Get('upcoming')
  @ResponseMessage('Upcoming flash sales fetched successfully')
  @ApiOperation({
    summary: 'Get list of upcoming scheduled flash sales (Public)',
  })
  getUpcomingFlashSales() {
    return this.flashSalesService.getUpcomingFlashSales();
  }

  @Public()
  @Get('slug/:slug')
  @ResponseMessage('Flash sale details fetched successfully')
  @ApiOperation({
    summary: 'Get flash sale campaign details by slug (Public)',
  })
  getCampaignBySlug(@Param('slug') slug: string) {
    return this.flashSalesService.getCampaignBySlug(slug);
  }

  // ── Admin Campaign Endpoints (RBAC Protected) ────────────────

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Flash sale campaign created successfully')
  @ApiOperation({
    summary:
      'Create a new flash sale campaign with product allocations (Admin/Manager)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Flash sale campaign and product stock allocations created',
  })
  create(@Body() createFlashSaleDto: CreateFlashSaleDto) {
    return this.flashSalesService.create(createFlashSaleDto);
  }

  @Get('admin/all')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('All flash sale campaigns retrieved')
  @ApiOperation({
    summary:
      'List all flash sale campaigns with status and progress metrics (Admin/Manager)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['LIVE', 'UPCOMING', 'ENDED', 'INACTIVE'],
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: 'LIVE' | 'UPCOMING' | 'ENDED' | 'INACTIVE',
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    return this.flashSalesService.findAll(pageNum, limitNum, status, search);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Flash sale campaign details retrieved')
  @ApiOperation({
    summary: 'Get flash sale campaign by ID with live metrics (Admin/Manager)',
  })
  findOne(@Param('id') id: string) {
    return this.flashSalesService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Flash sale campaign updated successfully')
  @ApiOperation({
    summary:
      'Update flash sale campaign details and product allocations (Admin/Manager)',
  })
  update(
    @Param('id') id: string,
    @Body() updateFlashSaleDto: UpdateFlashSaleDto,
  ) {
    return this.flashSalesService.update(id, updateFlashSaleDto);
  }

  @Patch(':id/toggle-status')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Flash sale campaign status toggled')
  @ApiOperation({
    summary: 'Toggle campaign active status (Admin/Manager)',
  })
  toggleStatus(@Param('id') id: string) {
    return this.flashSalesService.toggleStatus(id);
  }

  @Post(':id/claim')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Flash sale stock claimed successfully')
  @ApiOperation({
    summary:
      'Atomically claim / reserve flash sale stock allocation during order creation',
  })
  claimStock(@Param('id') id: string, @Body() claimStockDto: ClaimStockDto) {
    return this.flashSalesService.claimStock(id, claimStockDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Flash sale campaign deleted successfully')
  @ApiOperation({
    summary: 'Delete a flash sale campaign (Admin only)',
  })
  remove(@Param('id') id: string) {
    return this.flashSalesService.remove(id);
  }
}
