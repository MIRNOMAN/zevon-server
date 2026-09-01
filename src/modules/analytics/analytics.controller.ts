import { Controller, Get, Query, HttpStatus, HttpCode } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service.js';
import { SalesReportQueryDto } from './dto/index.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@ApiTags('Admin Analytics & Control Center')
@Controller('analytics')
@Roles('ADMIN', 'MANAGER')
@ApiBearerAuth('JWT-auth')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Dashboard analytics retrieved successfully')
  @ApiOperation({
    summary:
      'KPI & Chart Analytics: Total Revenue, Total Orders, Conversion Rate, AOV, and 30-day daily sales aggregation',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Returns dashboard KPI metrics and last 30-day daily sales array for chart rendering',
  })
  getDashboardMetrics() {
    return this.analyticsService.getDashboardMetrics();
  }

  @Get('inventory-alerts')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Inventory low-stock alerts retrieved successfully')
  @ApiOperation({
    summary:
      'Inventory Alerts: Low-stock clothing variant alerts (stock <= 5 or custom threshold) categorized by severity',
  })
  @ApiQuery({
    name: 'threshold',
    required: false,
    type: Number,
    example: 5,
    description: 'Stock quantity threshold (default: 5)',
  })
  getInventoryAlerts(@Query('threshold') threshold?: number) {
    const numericThreshold = threshold ? Number(threshold) : 5;
    return this.analyticsService.getInventoryAlerts(numericThreshold);
  }

  @Get('inventory-kanban')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Inventory Kanban board retrieved successfully')
  @ApiOperation({
    summary:
      'Inventory Kanban: Group store inventory into Out of Stock, Low Stock, and In Stock columns with warehouse valuation',
  })
  getInventoryKanban() {
    return this.analyticsService.getInventoryKanban();
  }

  @Get('sales-report')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Sales report generated successfully')
  @ApiOperation({
    summary:
      'Custom Sales Report: Date-range revenue, discounts, shipping, and order performance',
  })
  getSalesReport(@Query() query: SalesReportQueryDto) {
    return this.analyticsService.getSalesReport(query);
  }
}
