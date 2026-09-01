import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
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
import { StockAlertsService } from './stock-alerts.service.js';
import { SubscribeStockAlertDto, StockAlertQueryDto } from './dto/index.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';

@ApiTags('Notify Me (Back-in-Stock Alerts)')
@Controller('stock-alerts')
export class StockAlertsController {
  constructor(private readonly stockAlertsService: StockAlertsService) {}

  // ── Public & Customer Subscription ─────────────────────────────────────

  @Post('subscribe')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Subscribed to back-in-stock alert successfully')
  @ApiOperation({
    summary:
      'Notify Me When Available: Subscribe email/phone for back-in-stock alerts on out-of-stock variant',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Subscribed to automated email notifications upon variant restock',
  })
  subscribe(
    @Body() dto: SubscribeStockAlertDto,
    @CurrentUser('userId') userId?: string,
  ) {
    return this.stockAlertsService.subscribe(dto, userId);
  }

  @Get('my-alerts')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Customer stock alerts retrieved successfully')
  @ApiOperation({
    summary: 'Get list of active stock alerts for authenticated customer',
  })
  findMyAlerts(@CurrentUser('userId') userId: string) {
    return this.stockAlertsService.findMyAlerts(userId);
  }

  @Delete(':id')
  @Public()
  @ResponseMessage('Stock alert subscription cancelled')
  @ApiOperation({
    summary: 'Cancel a back-in-stock subscription',
  })
  cancelAlert(@Param('id') id: string, @CurrentUser('userId') userId?: string) {
    return this.stockAlertsService.cancelAlert(id, { userId });
  }

  // ── Admin Management ───────────────────────────────────────────────────

  @Get()
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Stock alerts retrieved successfully')
  @ApiOperation({
    summary:
      'List all customer stock alert subscriptions with filters and search (Admin/Manager)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  findAll(@Query() query: StockAlertQueryDto) {
    return this.stockAlertsService.findAll(query);
  }
}
