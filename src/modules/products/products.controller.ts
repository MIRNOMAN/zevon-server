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
import { ProductsService } from './products.service.js';
import {
  CreateProductDto,
  UpdateProductDto,
  ProductQueryDto,
} from './dto/index.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@ApiTags('Products & Clothing Inventory')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ── Public Storefront Endpoints ──────────────────────────────

  @Public()
  @Get()
  @ResponseMessage('Products retrieved successfully')
  @ApiOperation({
    summary:
      'Search and filter catalog products (Public - Categories, Price, Color, Size, Gender, Sort)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated list of products with available variants',
  })
  findAll(@Query() query: ProductQueryDto) {
    return this.productsService.findAll(query);
  }

  @Public()
  @Get(':slug')
  @ResponseMessage('Product details retrieved successfully')
  @ApiOperation({
    summary:
      'Get single product by SEO slug with gallery, variants, review rating, and related items (Public)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product details returned',
  })
  findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  // ── Admin Catalog Operations (RBAC Protected) ────────────────

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Multi-variant product created successfully')
  @ApiOperation({
    summary:
      'Create product with fabric specs, wash care, gallery images, and clothing SKU variants atomically inside a transaction (Admin/Manager)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Product and variants created atomically',
  })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get('admin/all')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Admin products list retrieved')
  @ApiOperation({
    summary:
      'List all products for inventory management with stock metrics (Admin/Manager)',
  })
  findAllAdmin(@Query() query: ProductQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get('admin/:id')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Admin product details retrieved')
  @ApiOperation({
    summary: 'Get product by ID with full inventory (Admin/Manager)',
  })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Product updated successfully')
  @ApiOperation({
    summary:
      'Update product base info, variants, and gallery inside a transaction (Admin/Manager)',
  })
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Patch(':id/toggle-publish')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Product publish status toggled')
  @ApiOperation({
    summary: 'Toggle product active publish status (Admin/Manager)',
  })
  togglePublish(@Param('id') id: string) {
    return this.productsService.togglePublish(id);
  }

  @Patch(':id/toggle-featured')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Product featured status toggled')
  @ApiOperation({
    summary: 'Toggle product featured showcase status (Admin/Manager)',
  })
  toggleFeatured(@Param('id') id: string) {
    return this.productsService.toggleFeatured(id);
  }

  @Patch('variants/:variantId/stock')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Variant stock updated successfully')
  @ApiOperation({
    summary: 'Quick adjust stock for a specific SKU variant (Admin/Manager)',
  })
  updateVariantStock(
    @Param('variantId') variantId: string,
    @Body('stock') stock: number,
  ) {
    return this.productsService.updateVariantStock(variantId, stock);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Product deleted successfully')
  @ApiOperation({
    summary: 'Delete a product and all variants/media (Admin only)',
  })
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
