import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { RecommendationsService } from './recommendations.service.js';
import { TrackViewDto } from './dto/index.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';

@ApiTags('Smart Recommendations & Recently Viewed')
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Post('track-view')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Product view recorded successfully')
  @ApiOperation({
    summary: 'Record customer/guest browsing history view event',
  })
  trackView(
    @Body() dto: TrackViewDto,
    @CurrentUser('userId') userId?: string,
  ) {
    return this.recommendationsService.trackView(dto, userId);
  }

  @Get('recently-viewed')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Recently viewed products retrieved successfully')
  @ApiOperation({
    summary:
      'Recently Viewed Carousel: Retrieve deduplicated products browsed by customer or guest session',
  })
  @ApiQuery({ name: 'sessionId', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  getRecentlyViewed(
    @Query('sessionId') sessionId?: string,
    @Query('limit') limit?: number,
    @CurrentUser('userId') userId?: string,
  ) {
    const numericLimit = limit ? Number(limit) : 10;
    return this.recommendationsService.getRecentlyViewed({
      userId,
      sessionId,
      limit: numericLimit,
    });
  }

  @Get('you-may-also-like/:productId')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Personalized cross-sell recommendations retrieved successfully')
  @ApiOperation({
    summary:
      'You May Also Like: Smart cross-sell product recommendations based on category, tags, and price similarity',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 8 })
  getYouMayAlsoLike(
    @Param('productId') productId: string,
    @Query('limit') limit?: number,
  ) {
    const numericLimit = limit ? Number(limit) : 8;
    return this.recommendationsService.getYouMayAlsoLike(productId, numericLimit);
  }

  @Get('trending')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Trending recommendations retrieved successfully')
  @ApiOperation({
    summary: 'Trending Recommendations Carousel: Top viewed and bestselling products',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 8 })
  getTrending(@Query('limit') limit?: number) {
    const numericLimit = limit ? Number(limit) : 8;
    return this.recommendationsService.getTrending(numericLimit);
  }
}
