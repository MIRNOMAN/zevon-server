import {
  Controller,
  Get,
  Post,
  Body,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { ReferralsService } from './referrals.service.js';
import { ApplyReferralDto } from './dto/index.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@ApiTags('Referral Program (Give ৳500, Get ৳500)')
@ApiBearerAuth('JWT-auth')
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('my-stats')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Referral stats retrieved successfully')
  @ApiOperation({
    summary:
      'Get your unique referral link, code, total friends invited, and cash reward earnings',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Returns referral code, shareable link, and program statistics',
  })
  getMyStats(@CurrentUser('userId') userId: string) {
    return this.referralsService.getReferralStats(userId);
  }

  @Post('apply')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Referral code applied successfully')
  @ApiOperation({
    summary:
      'Apply a friend referral code to your account to unlock ৳500 first-order bonus',
  })
  applyReferralCode(
    @CurrentUser('userId') userId: string,
    @Body() dto: ApplyReferralDto,
  ) {
    return this.referralsService.applyReferralCode(userId, dto.referralCode);
  }
}
