import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { ReviewsService } from './reviews.service.js';
import {
  CreateReviewDto,
  UpdateReviewDto,
  ReviewQueryDto,
} from './dto/index.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@ApiTags('Product Reviews & Ratings')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // ── Public Product Reviews ───────────────────────────────────

  @Public()
  @Get('product/:productId')
  @ResponseMessage('Product reviews retrieved successfully')
  @ApiOperation({
    summary:
      'Get reviews for a product with customer photos, star breakdown, and rating summary (Public)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Paginated list of reviews with aggregate breakdown (5★-1★) and average rating',
  })
  findByProduct(
    @Param('productId') productId: string,
    @Query() query: ReviewQueryDto,
  ) {
    return this.reviewsService.findByProduct(productId, query);
  }

  // ── Customer Review Operations (Authenticated) ───────────────

  @Post()
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Verified purchase review submitted successfully')
  @ApiOperation({
    summary:
      'Submit a verified review (Requires user to have a DELIVERED order for this product)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description:
      'Review created with isVerifiedPurchase: true, photos array, and updated product aggregate',
  })
  create(
    @CurrentUser('userId') userId: string,
    @Body() createReviewDto: CreateReviewDto,
  ) {
    return this.reviewsService.create(userId, createReviewDto);
  }

  @Get('eligibility/:productId')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Review eligibility checked')
  @ApiOperation({
    summary:
      'Check if authenticated customer is eligible to review a product (Has delivered order)',
  })
  checkEligibility(
    @CurrentUser('userId') userId: string,
    @Param('productId') productId: string,
  ) {
    return this.reviewsService.checkEligibility(userId, productId);
  }

  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Customer reviews retrieved successfully')
  @ApiOperation({
    summary: 'Get all reviews written by current authenticated customer',
  })
  findUserReviews(@CurrentUser('userId') userId: string) {
    return this.reviewsService.findUserReviews(userId);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Review updated successfully')
  @ApiOperation({
    summary: 'Update own review rating, feedback, or images',
  })
  update(
    @CurrentUser('userId') userId: string,
    @Param('id') reviewId: string,
    @Body() updateReviewDto: UpdateReviewDto,
  ) {
    return this.reviewsService.update(userId, reviewId, updateReviewDto);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Review deleted successfully')
  @ApiOperation({
    summary: 'Delete a review (Owner or Admin/Manager)',
  })
  remove(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') userRole: string,
    @Param('id') reviewId: string,
  ) {
    return this.reviewsService.remove(userId, reviewId, userRole);
  }
}
