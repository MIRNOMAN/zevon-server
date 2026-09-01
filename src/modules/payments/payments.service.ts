import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../../database/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { CreateCheckoutSessionDto } from './dto/index.js';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stripe: Stripe;
  private readonly webhookSecret: string;
  private readonly publishableKey: string;
  private readonly currency: string;
  private readonly defaultSuccessUrl: string;
  private readonly defaultCancelUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {
    const secretKey =
      this.configService.get<string>('stripe.secretKey') ||
      process.env.STRIPE_SECRET_KEY ||
      'sk_test_placeholder_key_for_dev';

    this.webhookSecret =
      this.configService.get<string>('stripe.webhookSecret') ||
      process.env.STRIPE_WEBHOOK_SECRET ||
      'whsec_placeholder_key_for_dev';

    this.publishableKey =
      this.configService.get<string>('stripe.publishableKey') ||
      process.env.STRIPE_PUBLISHABLE_KEY ||
      'pk_test_placeholder_key_for_dev';

    this.currency = (
      this.configService.get<string>('stripe.currency') || 'bdt'
    ).toLowerCase();

    this.defaultSuccessUrl = this.configService.get<string>(
      'stripe.successUrl',
      'http://localhost:3000/order/success?session_id={CHECKOUT_SESSION_ID}',
    );

    this.defaultCancelUrl = this.configService.get<string>(
      'stripe.cancelUrl',
      'http://localhost:3000/order/cancel',
    );

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
    });
  }

  /**
   * Initializes a Stripe Checkout Session for a specific customer order.
   */
  async createCheckoutSession(
    userId: string,
    createSessionDto: CreateCheckoutSessionDto,
  ) {
    const { orderId, successUrl, cancelUrl } = createSessionDto;

    // 1. Fetch Order from Database
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID "${orderId}" was not found.`);
    }

    if (order.userId !== userId) {
      throw new BadRequestException(
        'You do not have permission to pay for this order.',
      );
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException(
        `Order #${order.orderNumber} is already paid.`,
      );
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException(
        `Order #${order.orderNumber} is cancelled and cannot be paid.`,
      );
    }

    const totalAmountNum = Number(order.totalAmount);
    if (totalAmountNum <= 0) {
      throw new BadRequestException(
        'Order total amount must be greater than 0 to initialize Stripe payment.',
      );
    }

    // 2. Build Stripe Line Items
    // If discount was applied or for exact gross matching, create itemized lines or net total item
    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    const discountAmountNum = Number(order.discountAmount);
    const shippingCostNum = Number(order.shippingCost);

    if (discountAmountNum === 0 && order.items.length > 0) {
      // Direct 1-to-1 Line Items + Shipping
      lineItems = order.items.map((item) => ({
        price_data: {
          currency: this.currency,
          product_data: {
            name: item.productTitle,
            description:
              [item.color, item.size, item.sku].filter(Boolean).join(' | ') ||
              undefined,
          },
          unit_amount: Math.round(Number(item.unitPrice) * 100),
        },
        quantity: item.quantity,
      }));

      if (shippingCostNum > 0) {
        lineItems.push({
          price_data: {
            currency: this.currency,
            product_data: {
              name: 'Shipping & Delivery Fee',
            },
            unit_amount: Math.round(shippingCostNum * 100),
          },
          quantity: 1,
        });
      }
    } else {
      // If discount applied, create consolidated order line item matching totalAmount exactly
      lineItems = [
        {
          price_data: {
            currency: this.currency,
            product_data: {
              name: `Order #${order.orderNumber} Total Payment`,
              description: `Includes ${order.items.length} item(s)${
                shippingCostNum > 0
                  ? ` + ৳${shippingCostNum.toFixed(2)} shipping`
                  : ''
              }${
                discountAmountNum > 0
                  ? ` (Promo Discount: -৳${discountAmountNum.toFixed(2)})`
                  : ''
              }`,
            },
            unit_amount: Math.round(totalAmountNum * 100),
          },
          quantity: 1,
        },
      ];
    }

    // 3. Create Stripe Checkout Session
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: order.user.email,
      client_reference_id: order.id,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        userId: order.userId,
      },
      line_items: lineItems,
      success_url: successUrl || this.defaultSuccessUrl,
      cancel_url: cancelUrl || this.defaultCancelUrl,
    });

    this.logger.log(
      `💳 Stripe checkout session created: ${session.id} for Order #${order.orderNumber} (৳${totalAmountNum})`,
    );

    return {
      sessionId: session.id,
      sessionUrl: session.url,
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalAmount: totalAmountNum,
      currency: this.currency,
    };
  }

  /**
   * Handles incoming Stripe Webhook events.
   * Verifies cryptographic signature using raw body buffer.
   */
  async handleWebhook(rawBody: Buffer, signature: string) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Invalid signature';
      this.logger.error(
        `❌ Stripe Webhook Signature Verification Failed: ${errorMessage}`,
      );
      throw new BadRequestException(`Webhook Error: ${errorMessage}`);
    }

    this.logger.log(
      `🔔 Stripe Webhook received: [${event.type}] (ID: ${event.id})`,
    );

    // Handle specific Stripe event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        await this.handleCheckoutSessionCompleted(session);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        await this.handlePaymentIntentFailed(paymentIntent);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        await this.handleChargeRefunded(charge);
        break;
      }

      default:
        this.logger.debug(`ℹ️ Unhandled Stripe event type: ${event.type}`);
    }

    return {
      received: true,
      eventType: event.type,
      eventId: event.id,
    };
  }

  /**
   * Processes successful checkout session:
   * - Updates order paymentStatus to PAID
   * - Updates order status to CONFIRMED / PROCESSING
   * - Dispatches payment receipt email to customer
   */
  private async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
  ) {
    const orderId = session.metadata?.orderId || session.client_reference_id;

    if (!orderId) {
      this.logger.warn(
        `⚠️ checkout.session.completed event missing orderId in metadata (Session ID: ${session.id})`,
      );
      return;
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        items: true,
        shippingZone: true,
        coupon: true,
      },
    });

    if (!order) {
      this.logger.error(
        `❌ Order with ID "${orderId}" not found for webhook session ${session.id}`,
      );
      return;
    }

    // Idempotency: skip if already marked as PAID
    if (order.paymentStatus === PaymentStatus.PAID) {
      this.logger.log(
        `ℹ️ Order #${order.orderNumber} is already marked as PAID.`,
      );
      return;
    }

    // 1. Update Order in Database
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: PaymentMethod.STRIPE,
        status:
          order.status === OrderStatus.PENDING
            ? OrderStatus.PROCESSING
            : order.status,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: true,
      },
    });

    this.logger.log(
      `🎉 Order #${updatedOrder.orderNumber} payment marked as PAID via Stripe (Session: ${session.id})`,
    );

    // 2. Dispatch Customer Payment & Order Confirmation Email
    const customerEmail =
      updatedOrder.user?.email ||
      session.customer_details?.email ||
      ((order.shippingAddress as Record<string, unknown>)?.email as string);

    if (customerEmail) {
      const shippingAddr =
        (order.shippingAddress as Record<string, unknown>) || {};

      await this.mailService.sendOrderPaymentSuccessEmail({
        orderNumber: updatedOrder.orderNumber,
        customerName:
          updatedOrder.user?.name ||
          (shippingAddr.fullName as string) ||
          'Valued Customer',
        customerEmail,
        paymentMethod: 'Stripe (Credit / Debit Card)',
        transactionId: session.id,
        subtotal: Number(order.subtotal),
        discountAmount: Number(order.discountAmount),
        shippingCost: Number(order.shippingCost),
        totalAmount: Number(order.totalAmount),
        currency: this.currency.toUpperCase(),
        shippingAddress: {
          fullName: shippingAddr.fullName as string,
          phone: shippingAddr.phone as string,
          addressLine1: shippingAddr.addressLine1 as string,
          addressLine2: shippingAddr.addressLine2 as string,
          city: shippingAddr.city as string,
          state: shippingAddr.state as string,
          postalCode: shippingAddr.postalCode as string,
          country: shippingAddr.country as string,
        },
        items: updatedOrder.items.map((item) => ({
          productTitle: item.productTitle,
          sku: item.sku,
          size: item.size,
          color: item.color,
          unitPrice: Number(item.unitPrice),
          quantity: item.quantity,
          totalPrice: Number(item.totalPrice),
        })),
        createdAt: updatedOrder.createdAt,
      });
    }
  }

  /**
   * Processes failed payment intent.
   */
  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    const orderId = paymentIntent.metadata?.orderId;
    if (!orderId) return;

    await this.prisma.order.updateMany({
      where: { id: orderId, paymentStatus: { not: PaymentStatus.PAID } },
      data: {
        paymentStatus: PaymentStatus.FAILED,
      },
    });

    this.logger.warn(
      `⚠️ Payment failed for order ID "${orderId}" (PaymentIntent: ${paymentIntent.id})`,
    );
  }

  /**
   * Processes refunded charge.
   */
  private async handleChargeRefunded(charge: Stripe.Charge) {
    const orderId = charge.metadata?.orderId;
    if (!orderId) return;

    await this.prisma.order.updateMany({
      where: { id: orderId },
      data: {
        paymentStatus: PaymentStatus.REFUNDED,
      },
    });

    this.logger.log(`🔄 Order ID "${orderId}" payment marked as REFUNDED.`);
  }

  /**
   * Returns public Stripe client configuration.
   */
  getStripeConfig() {
    return {
      publishableKey: this.publishableKey,
      currency: this.currency,
    };
  }
}
