import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Req,
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
import type { Request } from 'express';
import { PaymentsService } from './payments.service.js';
import { CreateCheckoutSessionDto } from './dto/index.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';

@ApiTags('Payments & Stripe Gateway')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

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
    return this.paymentsService.createCheckoutSession(
      userId,
      createSessionDto,
    );
  }

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Stripe Webhook Listener for asynchronous payment events (checkout.session.completed, payment_intent.payment_failed)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Verifies Stripe cryptographic signature and updates order payment status and sends email confirmation',
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

  @Get('config')
  @Public()
  @ResponseMessage('Stripe configuration retrieved successfully')
  @ApiOperation({
    summary: 'Get public Stripe client configuration (publishable key & currency)',
  })
  getStripeConfig() {
    return this.paymentsService.getStripeConfig();
  }
}
