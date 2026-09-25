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
import { SustainabilityService, SustainabilityMetrics } from './sustainability.service.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@ApiTags('Sustainability')
@Controller('sustainability')
export class SustainabilityController {
  constructor(private readonly sustainabilityService: SustainabilityService) {}

  @Public()
  @Get()
  @ResponseMessage('Sustainability stories retrieved successfully')
  @ApiOperation({ summary: 'Get all published sustainability stories and eco commitments (Public)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Sustainability stories returned' })
  findAll() {
    return this.sustainabilityService.findAll();
  }

  @Public()
  @Get('metrics')
  @ResponseMessage('Sustainability metrics retrieved successfully')
  @ApiOperation({ summary: 'Get current sustainability key metrics and certifications' })
  getMetrics() {
    return this.sustainabilityService.getMetrics();
  }

  @Put('metrics')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Sustainability metrics updated successfully')
  @ApiOperation({ summary: 'Update sustainability metrics and impact statistics (Admin/Manager)' })
  updateMetrics(@Body() dto: Partial<SustainabilityMetrics>) {
    return this.sustainabilityService.updateMetrics(dto);
  }

  @Post('stories')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Sustainability story created successfully')
  @ApiOperation({ summary: 'Create new sustainability story / certification log (Admin/Manager)' })
  createStory(
    @Body()
    body: {
      title: string;
      slug?: string;
      summary: string;
      content: string;
      coverImageUrl: string;
      isPublished?: boolean;
    },
  ) {
    return this.sustainabilityService.createStory(body);
  }

  @Put('stories/:id')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Sustainability story updated successfully')
  @ApiOperation({ summary: 'Update sustainability story (Admin/Manager)' })
  updateStory(
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      slug?: string;
      summary?: string;
      content?: string;
      coverImageUrl?: string;
      isPublished?: boolean;
    },
  ) {
    return this.sustainabilityService.updateStory(id, body);
  }

  @Delete('stories/:id')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Sustainability story deleted successfully')
  @ApiOperation({ summary: 'Delete sustainability story (Admin/Manager)' })
  deleteStory(@Param('id') id: string) {
    return this.sustainabilityService.deleteStory(id);
  }
}
