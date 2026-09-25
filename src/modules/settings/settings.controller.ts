import { Controller, Get, Put, Body, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService, StoreSettings } from './settings.service.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get()
  @ResponseMessage('Store settings retrieved successfully')
  @ApiOperation({ summary: 'Get current store configuration and metadata (Public)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Store settings returned' })
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Put()
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Store settings updated successfully')
  @ApiOperation({ summary: 'Update store settings and brand configuration (Admin/Manager)' })
  updateSettings(@Body() dto: Partial<StoreSettings>) {
    return this.settingsService.updateSettings(dto);
  }
}
