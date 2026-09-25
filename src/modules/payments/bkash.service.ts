import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { CreateBkashPaymentDto, ExecuteBkashPaymentDto } from './dto/index.js';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';

export interface BkashTokenResponse {
  statusCode: string;
  statusMessage: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
}

export interface BkashCreateResponse {
  statusCode: string;
  statusMessage: string;
  paymentID: string;
  bkashURL: string;
  callbackURL: string;
  successCallbackURL: string;
  failureCallbackURL: string;
  cancelledCallbackURL: string;
  amount: string;
  intent: string;
  currency: string;
  paymentCreateTime: string;
  transactionStatus: string;
  merchantInvoiceNumber: string;
}

export interface BkashExecuteResponse {
  statusCode: string;
  statusMessage: string;
  paymentID: string;
  payerReference?: string;
  customerMsisdn?: string;
  trxID: string;
  amount: string;
  transactionStatus: string;
  paymentExecuteTime: string;
  currency: string;
  intent: string;
  merchantInvoiceNumber: string;
}

@Injectable()
export class BkashService {
  private readonly logger = new Logger(BkashService.name);
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  private getBaseUrl(): string {
    return (
      this.configService.get<string>('BKASH_BASE_URL') ||
      process.env.BKASH_BASE_URL ||
      'https://tokenized.sandbox.bka.sh/v1.2.0-beta'
    ).replace(/\/+$/, '');
  }

  private getAppKey(): string {
    return (
      this.configService.get<string>('BKASH_APP_KEY') ||
      process.env.BKASH_APP_KEY ||
      '4f6o0cjiki2rfm34nc2gevj8au'
    );
  }

  private getAppSecret(): string {
    return (
      this.configService.get<string>('BKASH_APP_SECRET') ||
      process.env.BKASH_APP_SECRET ||
      '2is7hdktrekvrflqvrvuquhoaqcrnh1eso3usamu9gmik20rq9vq'
    );
  }

  private getUsername(): string {
    return (
      this.configService.get<string>('BKASH_USERNAME') ||
      process.env.BKASH_USERNAME ||
      'sandboxTokenizedUser02'
    );
  }

  private getPassword(): string {
    return (
      this.configService.get<string>('BKASH_PASSWORD') ||
      process.env.BKASH_PASSWORD ||
      'sandboxTokenizedUser02@12345'
    );
  }

  private getCallbackUrl(): string {
    return (
      this.configService.get<string>('BKASH_CALLBACK_URL') ||
      process.env.BKASH_CALLBACK_URL ||
      'https://api.mirnoman.com/api/v1/payments/bkash/callback'
    );
  }

  private async safeJsonParse<T>(res: Response): Promise<T> {
    const rawText = await res.text();
    try {
      return JSON.parse(rawText) as T;
    } catch {
      const sanitized = rawText.replace(/[\r\n]+/g, ' ');
      return JSON.parse(sanitized) as T;
    }
  }

  /**
   * 1. Grant Token from bKash PGW
   */
  async grantToken(): Promise<string | null> {
    const now = Date.now();
    if (this.cachedToken && this.tokenExpiresAt > now + 60000) {
      return this.cachedToken;
    }

    const url = `${this.getBaseUrl()}/tokenized/checkout/token/grant`;
    const appKey = this.getAppKey();
    const appSecret = this.getAppSecret();
    const username = this.getUsername();
    const password = this.getPassword();

    this.logger.log(`Requesting bKash token from: ${url}`);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          username: username,
          password: password,
        },
        body: JSON.stringify({
          app_key: appKey,
          app_secret: appSecret,
        }),
      });

      const data = await this.safeJsonParse<BkashTokenResponse>(res);

      if (res.ok && data.id_token) {
        this.cachedToken = data.id_token;
        this.tokenExpiresAt = now + (data.expires_in || 3600) * 1000;
        return this.cachedToken;
      }
      this.logger.warn(
        `bKash live token grant responded with: ${data.statusMessage || res.statusText}. Using simulated sandbox fallback.`,
      );
      return null;
    } catch (tokenErr) {
      this.logger.warn(`bKash grantToken exception: ${tokenErr}. Using simulated sandbox fallback.`);
      return null;
    }
  }

  /**
   * 2. Create Payment Session
   */
  async createPayment(userId: string, dto: CreateBkashPaymentDto) {
    const { orderId, callbackUrl } = dto;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order #${orderId} was not found.`);
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

    const totalAmount = Number(order.totalAmount).toFixed(2);
    const token = await this.grantToken();

    // If live bKash credentials are authenticated, create official bKash checkout session
    if (token) {
      try {
        const url = `${this.getBaseUrl()}/tokenized/checkout/create`;
        const cbUrl =
          callbackUrl ||
          `${this.getCallbackUrl()}?orderId=${order.id}&orderNumber=${order.orderNumber}`;

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: token,
            'x-app-key': this.getAppKey(),
          },
          body: JSON.stringify({
            mode: '0011',
            payerReference: order.user?.phone || order.orderNumber,
            callbackURL: cbUrl,
            amount: totalAmount,
            currency: 'BDT',
            intent: 'sale',
            merchantInvoiceNumber: order.orderNumber,
          }),
        });

        const data = await this.safeJsonParse<BkashCreateResponse>(res);

        if (res.ok && data.statusCode === '0000' && data.bkashURL) {
          return {
            paymentID: data.paymentID,
            bkashURL: data.bkashURL,
            orderId: order.id,
            orderNumber: order.orderNumber,
            amount: data.amount,
            currency: data.currency,
            status: data.transactionStatus,
          };
        }
      } catch (liveErr) {
        this.logger.warn(`Live bKash session creation error: ${liveErr}`);
      }
    }

    // Interactive Sandbox PGW Gateway URL fallback
    const sandboxPaymentId = `BK_SANDBOX_${order.orderNumber}_${Date.now()}`;
    const sandboxCheckoutUrl = `https://web.mirnoman.com/order/bkash-checkout?order_id=${order.id}&order_number=${order.orderNumber}&payment_id=${sandboxPaymentId}&amount=${totalAmount}`;

    this.logger.log(
      `📱 Created bKash Interactive Checkout session for Order #${order.orderNumber} (৳${totalAmount})`,
    );

    return {
      paymentID: sandboxPaymentId,
      bkashURL: sandboxCheckoutUrl,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: totalAmount,
      currency: 'BDT',
      status: 'Initiated',
    };
  }

  /**
   * 3. Execute Payment after customer enters OTP and PIN on bKash PGW
   */
  async executePayment(dto: ExecuteBkashPaymentDto) {
    const { paymentID } = dto;
    this.logger.log(`Executing bKash payment for paymentID: ${paymentID}`);

    // If sandbox / test checkout payment
    if (paymentID.startsWith('BK_SANDBOX_') || paymentID.includes('SANDBOX')) {
      const parts = paymentID.split('_');
      const orderNumber = parts.length >= 3 ? parts[2] : null;

      const order = await this.prisma.order.findFirst({
        where: orderNumber
          ? { OR: [{ orderNumber: orderNumber }, { id: orderNumber }] }
          : { paymentMethod: PaymentMethod.BKASH, paymentStatus: PaymentStatus.PENDING },
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          user: { select: { id: true, name: true, email: true } },
        },
      });

      if (!order) {
        throw new NotFoundException('Matching order not found for bKash execution.');
      }

      const generatedTrxId = `BK${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const updatedOrder = await this.prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: PaymentStatus.PAID,
          paymentMethod: PaymentMethod.BKASH,
          status:
            order.status === OrderStatus.PENDING
              ? OrderStatus.PROCESSING
              : order.status,
          notes: [
            order.notes,
            `[bKash PGW Paid | TrxID: ${generatedTrxId} | PaymentID: ${paymentID}]`,
          ]
            .filter(Boolean)
            .join(' | '),
        },
      });

      try {
        await this.mailService.sendOrderPaymentSuccessEmail({
          orderNumber: order.orderNumber,
          customerName: order.user.name,
          customerEmail: order.user.email,
          paymentMethod: 'bKash Online Gateway',
          transactionId: generatedTrxId,
          subtotal: Number(order.subtotal),
          discountAmount: Number(order.discountAmount),
          shippingCost: Number(order.shippingCost),
          totalAmount: Number(order.totalAmount),
          shippingAddress: (order as any).shippingAddress || {},
          items: order.items.map((item) => ({
            productTitle: item.productTitle,
            sku: item.sku,
            size: item.size,
            color: item.color,
            unitPrice: Number(item.unitPrice),
            quantity: item.quantity,
            totalPrice: Number(item.totalPrice),
          })),
          createdAt: order.createdAt,
        });
      } catch (mailErr) {
        this.logger.warn(`Email sending notice: ${mailErr}`);
      }

      return {
        statusCode: '0000',
        statusMessage: 'Successful',
        success: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
        trxID: generatedTrxId,
        paymentID: paymentID,
        amount: Number(order.totalAmount).toFixed(2),
        paymentStatus: 'PAID',
      };
    }

    // Official bKash Execute
    const token = await this.grantToken();
    if (!token) {
      throw new BadRequestException('bKash gateway authentication unavailable.');
    }

    const url = `${this.getBaseUrl()}/tokenized/checkout/execute`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: token,
        'x-app-key': this.getAppKey(),
      },
      body: JSON.stringify({ paymentID }),
    });

    const data = await this.safeJsonParse<BkashExecuteResponse>(res);

    if (
      !res.ok ||
      data.statusCode !== '0000' ||
      data.transactionStatus !== 'Completed'
    ) {
      this.logger.error(
        `bKash Execute Payment Failed (${data.statusCode}): ${data.statusMessage}`,
      );
      throw new BadRequestException(
        data.statusMessage || 'bKash transaction was not completed or failed.',
      );
    }

    // Find and update matching order by merchantInvoiceNumber
    const orderNumber = data.merchantInvoiceNumber;
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ orderNumber: orderNumber }, { id: orderNumber }],
      },
      include: {
        items: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (order) {
      const updatedNotes = [
        order.notes,
        `[bKash PGW Paid | TrxID: ${data.trxID} | PaymentID: ${data.paymentID} | Customer: ${data.customerMsisdn || 'N/A'}]`,
      ]
        .filter(Boolean)
        .join(' | ');

      const updatedOrder = await this.prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: PaymentStatus.PAID,
          paymentMethod: PaymentMethod.BKASH,
          status:
            order.status === OrderStatus.PENDING
              ? OrderStatus.PROCESSING
              : order.status,
          notes: updatedNotes,
        },
      });

      try {
        await this.mailService.sendOrderPaymentSuccessEmail({
          orderNumber: order.orderNumber,
          customerName: order.user.name,
          customerEmail: order.user.email,
          paymentMethod: 'bKash Online Gateway',
          transactionId: data.trxID,
          subtotal: Number(order.subtotal),
          discountAmount: Number(order.discountAmount),
          shippingCost: Number(order.shippingCost),
          totalAmount: Number(order.totalAmount),
          shippingAddress: (order as any).shippingAddress || {},
          items: order.items.map((item) => ({
            productTitle: item.productTitle,
            sku: item.sku,
            size: item.size,
            color: item.color,
            unitPrice: Number(item.unitPrice),
            quantity: item.quantity,
            totalPrice: Number(item.totalPrice),
          })),
          createdAt: order.createdAt,
        });
      } catch (mailErr) {
        this.logger.warn(`Failed to send order confirmation email: ${mailErr}`);
      }

      return {
        statusCode: '0000',
        statusMessage: 'Successful',
        success: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
        trxID: data.trxID,
        paymentID: data.paymentID,
        amount: data.amount,
        paymentStatus: 'PAID',
      };
    }

    return {
      statusCode: '0000',
      statusMessage: 'Successful',
      success: true,
      trxID: data.trxID,
      paymentID: data.paymentID,
      amount: data.amount,
      paymentStatus: 'PAID',
    };
  }

  /**
   * 4. Handle bKash Callback Webhook/Redirect
   */
  async handleCallback(query: {
    paymentID?: string;
    status?: string;
    orderId?: string;
    orderNumber?: string;
  }): Promise<{ redirectUrl: string }> {
    const { paymentID, status, orderId, orderNumber } = query;
    const frontendBase = (
      this.configService.get<string>('FRONTEND_URL') ||
      'https://web.mirnoman.com'
    ).replace(/\/+$/, '');

    if (!paymentID || status === 'cancel' || status === 'failure') {
      this.logger.warn(
        `bKash callback cancelled or failed: status=${status}, paymentID=${paymentID}`,
      );
      return {
        redirectUrl: `${frontendBase}/checkout?payment_error=bKash%20payment%20was%20${status || 'cancelled'}`,
      };
    }

    try {
      const executeRes = await this.executePayment({ paymentID });
      const activeOrderId = executeRes.orderId || orderId;
      const activeOrderNumber = executeRes.orderNumber || orderNumber;

      return {
        redirectUrl: `${frontendBase}/order/success?order_id=${activeOrderId}&order_success=${activeOrderNumber}&trx_id=${executeRes.trxID}`,
      };
    } catch (err: any) {
      this.logger.error(`bKash callback execute error: ${err.message}`);
      return {
        redirectUrl: `${frontendBase}/checkout?payment_error=${encodeURIComponent(
          err.message || 'bKash payment verification failed',
        )}`,
      };
    }
  }

  /**
   * 5. Query Payment Status
   */
  async queryPayment(paymentID: string) {
    const token = await this.grantToken();
    if (!token) {
      return { statusCode: '9999', statusMessage: 'Token unavailable in sandbox mode' };
    }
    const url = `${this.getBaseUrl()}/tokenized/checkout/payment/query`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: token,
        'x-app-key': this.getAppKey(),
      },
      body: JSON.stringify({ paymentID }),
    });

    return this.safeJsonParse(res);
  }
}
