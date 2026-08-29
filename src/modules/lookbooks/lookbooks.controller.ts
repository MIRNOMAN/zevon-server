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
import { LookbooksService } from './lookbooks.service.js';
import { CreateLookbookDto, UpdateLookbookDto } from './dto/index.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@ApiTags('Shoppable Lookbook (Shop The Look)')
@Controller('lookbooks')
export class LookbooksController {
  constructor(private readonly lookbooksService: LookbooksService) {}

  // ── Public Shoppable Lookbook Endpoints ──────────────────────

  @Public()
  @Get()
  @ResponseMessage('Shoppable lookbooks fetched successfully')
  @ApiOperation({
    summary:
      'Get active lookbooks with populated hotspot products (Shop The Look)',
  })
  @ApiQuery({
    name: 'tag',
    required: false,
    example: 'Casual',
    description: 'Filter by style tag (Casual, Formal, Winter, Streetwear)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 12 })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'List of active lookbooks with interactive hotspot coordinates',
  })
  getActiveLookbooks(
    @Query('tag') tag?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 12;
    return this.lookbooksService.getActiveLookbooks(tag, pageNum, limitNum);
  }

  @Public()
  @Get('slug/:slug')
  @ResponseMessage('Lookbook details fetched successfully')
  @ApiOperation({
    summary:
      'Get single shoppable lookbook by slug with complete hotspot product details',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lookbook details with populated tagged products',
  })
  getLookbookBySlug(@Param('slug') slug: string) {
    return this.lookbooksService.getLookbookBySlug(slug);
  }

  // ── Admin Lookbook CMS Endpoints ─────────────────────────────

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Lookbook created successfully')
  @ApiOperation({
    summary:
      'Create a new Lookbook with interactive hotspot pins (Admin/Manager)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Lookbook and pins created successfully',
  })
  create(@Body() createLookbookDto: CreateLookbookDto) {
    return this.lookbooksService.create(createLookbookDto);
  }

  @Get('admin/all')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('All lookbooks retrieved for admin management')
  @ApiOperation({
    summary: 'List all lookbooks for management (Admin/Manager)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'tag', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('tag') tag?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const isActiveBool =
      isActive !== undefined ? isActive === 'true' : undefined;

    return this.lookbooksService.findAll(
      pageNum,
      limitNum,
      tag,
      isActiveBool,
      search,
    );
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Lookbook details retrieved')
  @ApiOperation({
    summary: 'Get lookbook by ID with hotspot pins (Admin/Manager)',
  })
  findOne(@Param('id') id: string) {
    return this.lookbooksService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Lookbook updated successfully')
  @ApiOperation({
    summary: 'Update lookbook and sync hotspot pins (Admin/Manager)',
  })
  update(
    @Param('id') id: string,
    @Body() updateLookbookDto: UpdateLookbookDto,
  ) {
    return this.lookbooksService.update(id, updateLookbookDto);
  }

  @Patch(':id/toggle-status')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Lookbook status toggled successfully')
  @ApiOperation({
    summary: 'Toggle lookbook active visibility (Admin/Manager)',
  })
  toggleStatus(@Param('id') id: string) {
    return this.lookbooksService.toggleStatus(id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Lookbook deleted successfully')
  @ApiOperation({ summary: 'Delete lookbook and all its pins (Admin only)' })
  remove(@Param('id') id: string) {
    return this.lookbooksService.remove(id);
  }
}
