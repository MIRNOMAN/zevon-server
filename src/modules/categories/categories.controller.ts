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
import { CategoriesService } from './categories.service.js';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  ReorderCategoriesDto,
} from './dto/index.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@ApiTags('Hierarchical Categories & Mega-Menu')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // ── Public Category & Mega-Menu Endpoints ────────────────────

  @Public()
  @Get('tree')
  @ResponseMessage('Category mega-menu tree fetched successfully')
  @ApiOperation({
    summary:
      'Get complete Hierarchical Nested Category Tree for Mega-Menu & Navigation (Public)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Nested JSON tree: Root Category -> Sub-Categories -> Child Categories',
  })
  getMegaMenuTree() {
    return this.categoriesService.getMegaMenuTree();
  }

  @Public()
  @Get()
  @ResponseMessage('Categories fetched successfully')
  @ApiOperation({ summary: 'List active categories (Public)' })
  @ApiQuery({
    name: 'onlyRoot',
    required: false,
    type: Boolean,
    description: 'Filter only top-level root categories',
  })
  @ApiQuery({
    name: 'parentId',
    required: false,
    type: String,
    description: 'Filter sub-categories by parent category ID',
  })
  findAll(
    @Query('onlyRoot') onlyRoot?: string,
    @Query('parentId') parentId?: string,
  ) {
    const isOnlyRoot = onlyRoot === 'true';
    return this.categoriesService.findAll(isOnlyRoot, parentId);
  }

  @Public()
  @Get(':slug')
  @ResponseMessage('Category details fetched successfully')
  @ApiOperation({
    summary:
      'Get category details by slug with parent breadcrumb and sub-categories (Public)',
  })
  findBySlug(@Param('slug') slug: string) {
    return this.categoriesService.findBySlug(slug);
  }

  // ── Admin Category Operations (RBAC Protected) ───────────────

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Category created successfully')
  @ApiOperation({
    summary:
      'Create a new category or sub-category with auto slug generation (Admin/Manager)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Category created with auto slugify',
  })
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get('admin/all')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('All categories retrieved for admin management')
  @ApiOperation({
    summary: 'List all categories for management with filters (Admin/Manager)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'parentId', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAllAdmin(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('parentId') parentId?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const isActiveBool =
      isActive !== undefined ? isActive === 'true' : undefined;

    return this.categoriesService.findAllAdmin(
      pageNum,
      limitNum,
      parentId,
      isActiveBool,
      search,
    );
  }

  @Get('admin/:id')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Category details retrieved')
  @ApiOperation({ summary: 'Get category details by ID (Admin/Manager)' })
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Patch('reorder')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Categories reordered successfully')
  @ApiOperation({
    summary:
      'Bulk reorder categories positions for mega-menu and sidebar (Admin/Manager)',
  })
  reorder(@Body() reorderCategoriesDto: ReorderCategoriesDto) {
    return this.categoriesService.reorder(reorderCategoriesDto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Category updated successfully')
  @ApiOperation({ summary: 'Update category information (Admin/Manager)' })
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Patch(':id/toggle-status')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Category visibility toggled')
  @ApiOperation({ summary: 'Toggle category active status (Admin/Manager)' })
  toggleStatus(@Param('id') id: string) {
    return this.categoriesService.toggleStatus(id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Category deleted successfully')
  @ApiOperation({ summary: 'Delete a category (Admin only)' })
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
