import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Req,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { CurrencyService } from './currency.service.js';
import { ConvertCurrencyDto, UpdateRatesDto } from './dto/index.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';

@ApiTags('Smart Currency & Geo-Location Switcher')
@Controller('currency')
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Get('rates')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Exchange rates retrieved successfully')
  @ApiOperation({
    summary:
      'Get active currency exchange rates table (Base: BDT -> USD, EUR, GBP)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Returns supported currencies with exchange rates, symbols, and formatting info',
  })
  getRates() {
    return this.currencyService.getRates();
  }

  @Get('convert')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Currency converted successfully')
  @ApiOperation({
    summary:
      'Real-time Currency Conversion: Convert any amount between BDT, USD, EUR, GBP',
  })
  @ApiQuery({ name: 'amount', required: true, type: Number, example: 2500 })
  @ApiQuery({ name: 'from', required: false, type: String, example: 'BDT' })
  @ApiQuery({ name: 'to', required: false, type: String, example: 'USD' })
  convert(@Query() dto: ConvertCurrencyDto) {
    return this.currencyService.convert(dto);
  }

  @Post('detect')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Geo-location currency preference detected successfully')
  @ApiOperation({
    summary:
      'Auto-detect visitor country & recommended currency from IP headers (Cloudflare, X-Forwarded-For)',
  })
  detectLocation(@Req() req: Request) {
    const headers = req.headers as Record<
      string,
      string | string[] | undefined
    >;
    const clientIp =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    return this.currencyService.detectLocation(headers, clientIp);
  }

  @Patch('rates')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Exchange rates updated successfully')
  @ApiOperation({
    summary: 'Update exchange conversion rates (Admin/Manager)',
  })
  updateRates(@Body() dto: UpdateRatesDto) {
    return this.currencyService.updateRates(dto);
  }
}
