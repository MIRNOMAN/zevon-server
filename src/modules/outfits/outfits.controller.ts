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
  ApiResponse,
} from '@nestjs/swagger';
import { OutfitsService } from './outfits.service.js';
import {
  CreateOutfitDto,
  UpdateOutfitDto,
  CalculateOutfitTotalDto,
  OutfitCheckoutBundleDto,
  OutfitQueryDto,
} from './dto/index.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@ApiTags('Interactive Outfit Builder & Mix-and-Match Canvas')
@Controller('outfits')
export class OutfitsController {
  constructor(private readonly outfitsService: OutfitsService) {}

  // ── Public Storefront Endpoints ──────────────────────────────

  @Public()
  @Get()
  @ResponseMessage('Outfits retrieved successfully')
  @ApiOperation({
    summary:
      'List curated and trending outfits with slot previews and bundle pricing (Public)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Paginated list of styled outfits with individual and bundle pricing',
  })
  findAll(@Query() query: OutfitQueryDto) {
    return this.outfitsService.findAll(query);
  }

  @Public()
  @Post('calculate-total')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Live outfit bundle total calculated')
  @ApiOperation({
    summary:
      'Mix & Match Canvas Live Calculator: Calculate live bundle total, discount savings, and real-time inventory for selected Top + Bottom + Shoes variants (Public)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Live computed subtotal, applied bundle discount percent (e.g. 10%), bundle total price, and item stock statuses',
  })
  calculateBundleTotal(@Body() dto: CalculateOutfitTotalDto) {
    return this.outfitsService.calculateBundleTotal(dto);
  }

  @Public()
  @Get(':idOrSlug')
  @ResponseMessage('Outfit canvas details retrieved')
  @ApiOperation({
    summary:
      'Get full Interactive Outfit Builder canvas layout by ID or slug with all garment slots, variant selectors, and live prices (Public)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Full outfit canvas configuration with coordinate positions, variant swatches, and bundle savings',
  })
  findOne(@Param('idOrSlug') idOrSlug: string) {
    return this.outfitsService.findOne(idOrSlug);
  }

  // ── Customer Authenticated Endpoints ─────────────────────────

  @Post('bundle-to-cart')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Outfit bundle added to cart successfully')
  @ApiOperation({
    summary:
      '1-Click Outfit Checkout: Atomically add all selected garments (Top, Bottom, Footwear) from canvas directly to shopping cart (Customer)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'All outfit variants atomically placed in customer cart',
  })
  addBundleToCart(
    @CurrentUser('id') userId: string,
    @Body() dto: OutfitCheckoutBundleDto,
  ) {
    return this.outfitsService.addBundleToCart(userId, dto);
  }

  @Post('my-outfits')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Custom mix & match outfit saved')
  @ApiOperation({
    summary:
      'Save personalized Mix & Match Outfit creation to user wardrobe (Customer)',
  })
  saveUserOutfit(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateOutfitDto,
  ) {
    return this.outfitsService.saveUserOutfit(userId, dto);
  }

  @Get('user/my-outfits')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('User saved outfits retrieved')
  @ApiOperation({
    summary:
      "Get customer's saved custom mix & match outfit designs (Customer)",
  })
  getUserOutfits(@CurrentUser('id') userId: string) {
    return this.outfitsService.getUserOutfits(userId);
  }

  // ── Admin / Stylist Endpoints ────────────────────────────────

  @Post('admin')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Curated outfit created successfully')
  @ApiOperation({
    summary:
      'Create curated brand stylist outfit with canvas coordinates and bundle discount (Admin/Manager)',
  })
  createCurated(@Body() dto: CreateOutfitDto) {
    return this.outfitsService.createCurated(dto);
  }

  @Patch('admin/:id')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Outfit updated successfully')
  @ApiOperation({
    summary:
      'Update outfit canvas slots, positions, and details (Admin/Manager)',
  })
  update(@Param('id') id: string, @Body() dto: UpdateOutfitDto) {
    return this.outfitsService.update(id, dto);
  }

  @Delete('admin/:id')
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Outfit deleted successfully')
  @ApiOperation({
    summary: 'Delete outfit (Admin only)',
  })
  remove(@Param('id') id: string) {
    return this.outfitsService.remove(id);
  }
}
