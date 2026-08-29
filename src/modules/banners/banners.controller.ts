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
import { BannerPlacement } from '@prisma/client';
import { BannersService } from './banners.service.js';
import {
  CreateBannerDto,
  UpdateBannerDto,
  ReorderBannersDto,
} from './dto/index.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@ApiTags('Home Banners & Hero Slider')
@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  // ── Public Frontend Endpoints ────────────────────────────────

  @Public()
  @Get()
  @ResponseMessage('Active banners fetched successfully')
  @ApiOperation({
    summary: 'Fetch active sorted banners for Home page & Hero slider (Public)',
  })
  @ApiQuery({
    name: 'placement',
    enum: BannerPlacement,
    required: false,
    description: 'Filter by placement location (e.g. HERO, SECTION_TOP)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of active, schedule-valid banners sorted by sortOrder',
  })
  getActiveBanners(@Query('placement') placement?: BannerPlacement) {
    return this.bannersService.getActiveBanners(placement);
  }

  @Public()
  @Get(':id')
  @ResponseMessage('Banner retrieved successfully')
  @ApiOperation({ summary: 'Get a single banner by ID (Public)' })
  findOne(@Param('id') id: string) {
    return this.bannersService.findOne(id);
  }

  // ── Admin Management Endpoints (RBAC Protected) ──────────────

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Banner created successfully')
  @ApiOperation({ summary: 'Create a new banner slide (Admin/Manager)' })
  create(@Body() createBannerDto: CreateBannerDto) {
    return this.bannersService.create(createBannerDto);
  }

  @Get('admin/all')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('All banners retrieved for management')
  @ApiOperation({
    summary: 'List all banners with pagination and filter (Admin/Manager)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'placement', enum: BannerPlacement, required: false })
  @ApiQuery({ name: 'isActive', type: Boolean, required: false })
  @ApiQuery({ name: 'search', type: String, required: false })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('placement') placement?: BannerPlacement,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 20;
    const isActiveBool =
      isActive !== undefined ? isActive === 'true' : undefined;

    return this.bannersService.findAll(
      pageNumber,
      limitNumber,
      placement,
      isActiveBool,
      search,
    );
  }

  @Patch('reorder')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Banners reordered successfully')
  @ApiOperation({
    summary:
      'Bulk update sort positions for hero slider/banners (Admin/Manager)',
  })
  reorder(@Body() reorderBannersDto: ReorderBannersDto) {
    return this.bannersService.reorder(reorderBannersDto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Banner updated successfully')
  @ApiOperation({ summary: 'Update banner information (Admin/Manager)' })
  update(@Param('id') id: string, @Body() updateBannerDto: UpdateBannerDto) {
    return this.bannersService.update(id, updateBannerDto);
  }

  @Patch(':id/toggle-status')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Banner status toggled successfully')
  @ApiOperation({ summary: 'Toggle banner active visibility (Admin/Manager)' })
  toggleStatus(@Param('id') id: string) {
    return this.bannersService.toggleStatus(id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Banner deleted successfully')
  @ApiOperation({ summary: 'Delete a banner (Admin only)' })
  remove(@Param('id') id: string) {
    return this.bannersService.remove(id);
  }
}
