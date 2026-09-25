import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StoresService, CreateStoreDto, UpdateStoreDto } from './stores.service.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@ApiTags('Store Locations')
@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Public()
  @Get()
  @ResponseMessage('Store locations retrieved successfully')
  @ApiOperation({ summary: 'Get all active store locations and flagship studios (Public)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Store locations returned' })
  findAll() {
    return this.storesService.findAll();
  }

  @Public()
  @Get(':id')
  @ResponseMessage('Store location retrieved successfully')
  @ApiOperation({ summary: 'Get single store location details (Public)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Store location returned' })
  findOne(@Param('id') id: string) {
    return this.storesService.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Store location created successfully')
  @ApiOperation({ summary: 'Create new physical store branch (Admin/Manager)' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Store branch created' })
  create(@Body() dto: CreateStoreDto) {
    return this.storesService.create(dto);
  }

  @Put(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Store location updated successfully')
  @ApiOperation({ summary: 'Update store branch details (Admin/Manager)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Store branch updated' })
  update(@Param('id') id: string, @Body() dto: UpdateStoreDto) {
    return this.storesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Store location deleted successfully')
  @ApiOperation({ summary: 'Delete store branch (Admin/Manager)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Store branch deleted' })
  remove(@Param('id') id: string) {
    return this.storesService.remove(id);
  }
}
