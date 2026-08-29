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
import { AddressType, Role } from '@prisma/client';
import { AddressesService } from './addresses.service.js';
import { CreateAddressDto, UpdateAddressDto } from './dto/index.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@ApiTags('Customer Addresses')
@ApiBearerAuth('JWT-auth')
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Address created successfully')
  @ApiOperation({
    summary: 'Add a new shipping or billing address for current user',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Address created with default toggle if applicable',
  })
  create(
    @CurrentUser('id') userId: string,
    @Body() createAddressDto: CreateAddressDto,
  ) {
    return this.addressesService.create(userId, createAddressDto);
  }

  @Get()
  @ResponseMessage('Addresses retrieved successfully')
  @ApiOperation({ summary: 'Get all addresses of the authenticated customer' })
  @ApiQuery({
    name: 'type',
    enum: AddressType,
    required: false,
    description: 'Filter by SHIPPING or BILLING',
  })
  findAll(
    @CurrentUser('id') userId: string,
    @Query('type') type?: AddressType,
  ) {
    return this.addressesService.findAll(userId, type);
  }

  @Get(':id')
  @ResponseMessage('Address details retrieved')
  @ApiOperation({ summary: 'Get a specific address by ID' })
  findOne(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
    @Param('id') id: string,
  ) {
    return this.addressesService.findOne(userId, id, userRole);
  }

  @Patch(':id')
  @ResponseMessage('Address updated successfully')
  @ApiOperation({ summary: 'Update an address by ID' })
  update(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
    @Param('id') id: string,
    @Body() updateAddressDto: UpdateAddressDto,
  ) {
    return this.addressesService.update(userId, id, updateAddressDto, userRole);
  }

  @Patch(':id/default')
  @ResponseMessage('Address set as default successfully')
  @ApiOperation({ summary: 'Set address as default for its address type' })
  setDefault(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.addressesService.setDefault(userId, id);
  }

  @Delete(':id')
  @ResponseMessage('Address deleted successfully')
  @ApiOperation({ summary: 'Delete an address' })
  remove(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
    @Param('id') id: string,
  ) {
    return this.addressesService.remove(userId, id, userRole);
  }
}
