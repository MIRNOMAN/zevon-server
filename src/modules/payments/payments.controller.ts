import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Headers,
  Req,
  Res,
  HttpStatus,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { PaymentsService } from './payments.service.js';
import { BkashService } from './bkash.service.js';
import {
  CreateCheckoutSessionDto,
  CreateBkashPaymentDto,
  ExecuteBkashPaymentDto,
} from './dto/index.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';

@ApiTags('Payments & Gateways')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly bkashService: BkashService,
  ) {}

  // ── Stripe Checkout Endpoints ────────────────────────────────
  @Post('checkout-session')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Stripe checkout session initialized successfully')
  @ApiOperation({
    summary:
      'Initialize Stripe Checkout hosted session for an existing order with metadata and line items',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Returns Stripe session ID and redirection URL to complete payment',
  })
  createCheckoutSession(
    @CurrentUser('userId') userId: string,
    @Body() createSessionDto: CreateCheckoutSessionDto,
  ) {
    return this.paymentsService.createCheckoutSession(userId, createSessionDto);
  }

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Stripe Webhook Listener for asynchronous payment events (checkout.session.completed, payment_intent.payment_failed)',
  })
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const rawBody = req.rawBody;

    if (!rawBody) {
      throw new BadRequestException(
        'Raw request body buffer not available for signature verification. Ensure rawBody is enabled in main.ts.',
      );
    }

    return this.paymentsService.handleWebhook(rawBody, signature);
  }

  @Get('verify/:sessionId')
  @Public()
  @ResponseMessage('Payment session verified')
  @ApiOperation({
    summary: 'Verify Stripe checkout session status and update order',
  })
  verifySession(@Param('sessionId') sessionId: string) {
    return this.paymentsService.verifySession(sessionId);
  }

  @Get('config')
  @Public()
  @ResponseMessage('Stripe configuration retrieved successfully')
  @ApiOperation({
    summary:
      'Get public Stripe client configuration (publishable key & currency)',
  })
  getStripeConfig() {
    return this.paymentsService.getStripeConfig();
  }

  // ── bKash Tokenized Checkout PGW Endpoints ───────────────────

  @Post('bkash/create')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('bKash payment checkout session created successfully')
  @ApiOperation({
    summary: 'Initialize bKash Tokenized Checkout payment session',
  })
  createBkashPayment(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateBkashPaymentDto,
  ) {
    return this.bkashService.createPayment(userId, dto);
  }

  @Post('bkash/execute')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('bKash payment executed and verified successfully')
  @ApiOperation({
    summary: 'Execute bKash payment with paymentID',
  })
  executeBkashPayment(@Body() dto: ExecuteBkashPaymentDto) {
    return this.bkashService.executePayment(dto);
  }

  @Get('bkash/callback')
  @Public()
  @ApiOperation({
    summary: 'bKash PGW Redirect Callback URL handler',
  })
  async handleBkashCallback(
    @Query('paymentID') paymentID: string,
    @Query('status') status: string,
    @Query('orderId') orderId: string,
    @Query('orderNumber') orderNumber: string,
    @Res() res: Response,
  ) {
    const result = await this.bkashService.handleCallback({
      paymentID,
      status,
      orderId,
      orderNumber,
    });
    return res.redirect(result.redirectUrl);
  }

  @Get('bkash/query/:paymentId')
  @Public()
  @ResponseMessage('bKash payment status retrieved')
  @ApiOperation({
    summary: 'Query bKash payment status by paymentID',
  })
  queryBkashPayment(@Param('paymentId') paymentId: string) {
    return this.bkashService.queryPayment(paymentId);
  }
}
