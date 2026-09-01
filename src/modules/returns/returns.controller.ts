import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
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
import { ReturnsService } from './returns.service.js';
import {
  CreateReturnRequestDto,
  UpdateReturnStatusDto,
  ReturnQueryDto,
  TrackReturnDto,
} from './dto/index.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';

@ApiTags('Self-Service Returns & Exchanges')
@Controller('returns')
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  // ── Public Return Tracking ──────────────────────────────────────────────

  @Post('track')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Return tracking details retrieved successfully')
  @ApiOperation({
    summary:
      'Public Return Tracking: Track return progress using return reference (e.g. RET-20260901-4821) and email/phone',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns milestone stepper and status of the return request',
  })
  trackReturn(@Body() trackReturnDto: TrackReturnDto) {
    return this.returnsService.trackReturn(trackReturnDto);
  }

  // ── Customer Self-Service Return Endpoints ──────────────────────────────

  @Post()
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Return request submitted successfully')
  @ApiOperation({
    summary:
      'Customer Self-Service: Submit a return/exchange request for an item in a delivered order',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Returns created return request with tracking reference',
  })
  create(
    @CurrentUser('userId') userId: string,
    @Body() createReturnDto: CreateReturnRequestDto,
  ) {
    return this.returnsService.create(userId, createReturnDto);
  }

  @Get('my-returns')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Customer returns retrieved successfully')
  @ApiOperation({
    summary: 'Get paginated list of my submitted return requests',
  })
  findMyReturns(
    @CurrentUser('userId') userId: string,
    @Query() query: ReturnQueryDto,
  ) {
    return this.returnsService.findMyReturns(userId, query);
  }

  @Get('my-returns/:id')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Return request details retrieved successfully')
  @ApiOperation({
    summary: 'Get details of a specific return request for customer',
  })
  findMyReturnById(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.returnsService.findMyReturnById(userId, id);
  }

  // ── Admin & Manager Return Management (RBAC) ────────────────────────────

  @Get()
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Returns list retrieved successfully')
  @ApiOperation({
    summary: 'List all return requests with filters and search (Admin/Manager)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  findAll(@Query() query: ReturnQueryDto) {
    return this.returnsService.findAll(query);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Return details retrieved successfully')
  @ApiOperation({
    summary: 'Get return request full details by ID (Admin/Manager)',
  })
  findOne(@Param('id') id: string) {
    return this.returnsService.findOne(id);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Return request status updated successfully')
  @ApiOperation({
    summary:
      'Update return request status (APPROVED, REJECTED, RECEIVED, REFUNDED), notes, or refund amount',
  })
  updateStatus(
    @Param('id') id: string,
    @Body() updateReturnStatusDto: UpdateReturnStatusDto,
  ) {
    return this.returnsService.updateStatus(id, updateReturnStatusDto);
  }
}
