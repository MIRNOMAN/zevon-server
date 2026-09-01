import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

export interface PaymentEmailContext {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  paymentMethod: string;
  transactionId?: string;
  subtotal: number;
  discountAmount: number;
  shippingCost: number;
  totalAmount: number;
  currency?: string;
  shippingAddress: {
    fullName?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  items: Array<{
    productTitle: string;
    sku?: string | null;
    size?: string | null;
    color?: string | null;
    unitPrice: number;
    quantity: number;
    totalPrice: number;
  }>;
  createdAt: Date | string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private readonly fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('mail.host');
    const user = this.configService.get<string>('mail.user');
    const pass = this.configService.get<string>('mail.pass');
    const port = this.configService.get<number>('mail.port', 587);
    const secure = this.configService.get<boolean>('mail.secure', false);
    this.fromEmail = this.configService.get<string>(
      'mail.from',
      'ZEVON Store <no-reply@zevon.com>',
    );

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
      });
      this.logger.log(`📧 SMTP Mail Transporter configured (${host}:${port})`);
    } else {
      this.logger.warn(
        '⚠️ SMTP credentials not configured. Outgoing emails will be logged to console in development mode.',
      );
    }
  }

  /**
   * Sends order payment confirmation and itemized receipt to client's email.
   */
  async sendOrderPaymentSuccessEmail(
    context: PaymentEmailContext,
  ): Promise<boolean> {
    const subject = `Order Confirmed #${context.orderNumber} - Payment Successful | ZEVON`;
    const htmlContent = this.generateReceiptHtml(context);

    try {
      if (this.transporter) {
        await this.transporter.sendMail({
          from: this.fromEmail,
          to: context.customerEmail,
          subject,
          html: htmlContent,
        });
        this.logger.log(
          `✅ Order payment confirmation email sent to ${context.customerEmail} for order #${context.orderNumber}`,
        );
      } else {
        this.logger.log(
          `📨 [DEV/FALLBACK EMAIL] To: ${context.customerEmail} | Subject: ${subject} | Total Paid: ৳${context.totalAmount}`,
        );
      }
      return true;
    } catch (error) {
      this.logger.error(
        `❌ Failed to send order receipt email to ${context.customerEmail} for order #${context.orderNumber}`,
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }

  /**
   * Generates a modern, responsive HTML receipt template.
   */
  private generateReceiptHtml(ctx: PaymentEmailContext): string {
    const itemsHtml = ctx.items
      .map(
        (item) => `
        <tr>
          <td style="padding: 12px 8px; border-bottom: 1px solid #edf2f7;">
            <div style="font-weight: 600; color: #1a202c;">${item.productTitle}</div>
            <div style="font-size: 12px; color: #718096;">
              ${item.color ? `Color: ${item.color} | ` : ''}${item.size ? `Size: ${item.size}` : ''}
              ${item.sku ? ` (${item.sku})` : ''}
            </div>
          </td>
          <td style="padding: 12px 8px; text-align: center; border-bottom: 1px solid #edf2f7; color: #4a5568;">
            ${item.quantity}
          </td>
          <td style="padding: 12px 8px; text-align: right; border-bottom: 1px solid #edf2f7; color: #4a5568;">
            ৳${item.unitPrice.toFixed(2)}
          </td>
          <td style="padding: 12px 8px; text-align: right; border-bottom: 1px solid #edf2f7; font-weight: 600; color: #1a202c;">
            ৳${item.totalPrice.toFixed(2)}
          </td>
        </tr>`,
      )
      .join('');

    const formattedDate = new Date(ctx.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const addr = ctx.shippingAddress || {};

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Order Receipt #${ctx.orderNumber}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7fafc; margin: 0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
      <h1 style="margin: 0 0 8px; font-size: 28px; letter-spacing: 2px; text-transform: uppercase; font-weight: 800;">ZEVON</h1>
      <p style="margin: 0; font-size: 16px; color: #cbd5e0;">Payment Received & Order Confirmed</p>
    </div>

    <div style="padding: 32px 24px;">
      <!-- Greeting & Status -->
      <div style="margin-bottom: 24px;">
        <h2 style="margin: 0 0 8px; font-size: 20px; color: #1a202c;">Thank you for your order, ${ctx.customerName}!</h2>
        <p style="margin: 0; color: #4a5568; font-size: 14px; line-height: 1.6;">
          Your payment has been successfully processed via <strong>${ctx.paymentMethod}</strong>. We are getting your clothing items ready for dispatch.
        </p>
      </div>

      <!-- Order Metadata Box -->
      <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 24px; border: 1px solid #e2e8f0; font-size: 13px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="color: #718096;">Order Number:</span>
          <strong style="color: #1a202c;">#${ctx.orderNumber}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="color: #718096;">Order Date:</span>
          <span style="color: #2d3748;">${formattedDate}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="color: #718096;">Payment Status:</span>
          <span style="color: #38a169; font-weight: bold;">PAID (Success)</span>
        </div>
        ${
          ctx.transactionId
            ? `<div style="display: flex; justify-content: space-between;">
          <span style="color: #718096;">Stripe Session/Ref:</span>
          <span style="color: #4a5568; font-family: monospace;">${ctx.transactionId}</span>
        </div>`
            : ''
        }
      </div>

      <!-- Items Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
        <thead>
          <tr style="background-color: #edf2f7; text-align: left;">
            <th style="padding: 10px 8px; color: #4a5568; font-weight: 600;">Item</th>
            <th style="padding: 10px 8px; text-align: center; color: #4a5568; font-weight: 600;">Qty</th>
            <th style="padding: 10px 8px; text-align: right; color: #4a5568; font-weight: 600;">Unit Price</th>
            <th style="padding: 10px 8px; text-align: right; color: #4a5568; font-weight: 600;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <!-- Financial Totals -->
      <div style="margin-left: auto; max-width: 260px; font-size: 14px; margin-bottom: 32px;">
        <div style="display: flex; justify-content: space-between; padding: 6px 0; color: #718096;">
          <span>Subtotal:</span>
          <span style="color: #1a202c;">৳${ctx.subtotal.toFixed(2)}</span>
        </div>
        ${
          ctx.discountAmount > 0
            ? `<div style="display: flex; justify-content: space-between; padding: 6px 0; color: #e53e3e;">
          <span>Coupon Discount:</span>
          <span>-৳${ctx.discountAmount.toFixed(2)}</span>
        </div>`
            : ''
        }
        <div style="display: flex; justify-content: space-between; padding: 6px 0; color: #718096;">
          <span>Shipping:</span>
          <span style="color: #1a202c;">${ctx.shippingCost === 0 ? 'FREE' : `৳${ctx.shippingCost.toFixed(2)}`}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 10px 0; border-top: 2px solid #e2e8f0; font-size: 16px; font-weight: 700; color: #1a202c;">
          <span>Total Paid:</span>
          <span style="color: #2b6cb0;">৳${ctx.totalAmount.toFixed(2)}</span>
        </div>
      </div>

      <!-- Shipping Address Box -->
      <div style="background-color: #f7fafc; border-radius: 8px; padding: 16px; border: 1px solid #e2e8f0; font-size: 13px; color: #4a5568; margin-bottom: 24px;">
        <h3 style="margin: 0 0 8px; font-size: 14px; color: #1a202c; text-transform: uppercase; letter-spacing: 0.5px;">Shipping Destination</h3>
        <div><strong>${addr.fullName || ctx.customerName}</strong></div>
        <div>${addr.addressLine1 || ''}${addr.addressLine2 ? `, ${addr.addressLine2}` : ''}</div>
        <div>${addr.city || ''}${addr.state ? `, ${addr.state}` : ''} ${addr.postalCode ? `- ${addr.postalCode}` : ''}</div>
        <div>${addr.country || 'Bangladesh'}</div>
        ${addr.phone ? `<div style="margin-top: 4px;">Phone: ${addr.phone}</div>` : ''}
      </div>

      <!-- Footer Help -->
      <p style="margin: 0; font-size: 13px; color: #a0aec0; text-align: center; line-height: 1.5;">
        If you have questions about your order, please reply to this email or visit our Support Center.<br>
        © ${new Date().getFullYear()} ZEVON Official. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Back-in-Stock Alert: Sends notification email when variant inventory is restocked.
   */
  async sendBackInStockEmail(ctx: {
    customerEmail: string;
    customerName?: string;
    productTitle: string;
    productSlug: string;
    sku: string;
    size: string;
    color: string;
    unitPrice: number;
    imageUrl?: string | null;
  }): Promise<boolean> {
    const subject = `🔥 It's Back! ${ctx.productTitle} (${ctx.color}, ${ctx.size}) is now in stock!`;
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc;">
  <div style="max-width: 600px; margin: 30px auto; background: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155;">
    <div style="background: linear-gradient(135deg, #059669, #0d9488); padding: 30px 20px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 24px; letter-spacing: 2px;">ZEVON</h1>
      <p style="margin: 8px 0 0; color: #a7f3d0; font-size: 14px; text-transform: uppercase; font-weight: 600;">Back in Stock Notification</p>
    </div>
    <div style="padding: 30px;">
      <p style="font-size: 16px; margin: 0 0 16px; color: #cbd5e1;">Good news${ctx.customerName ? ` ${ctx.customerName}` : ''}!</p>
      <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 24px;">
        An item you requested is back in stock at ZEVON. Inventory is limited, so grab yours before it sells out again.
      </p>
      <div style="background-color: #0f172a; border-radius: 8px; padding: 20px; border: 1px solid #334155; margin-bottom: 24px;">
        <h3 style="margin: 0 0 8px; font-size: 18px; color: #ffffff;">${ctx.productTitle}</h3>
        <p style="margin: 0 0 4px; font-size: 14px; color: #38bdf8;"><strong>Color:</strong> ${ctx.color} | <strong>Size:</strong> ${ctx.size}</p>
        <p style="margin: 0 0 4px; font-size: 13px; color: #64748b;"><strong>SKU:</strong> ${ctx.sku}</p>
        <p style="margin: 12px 0 0; font-size: 18px; font-weight: 700; color: #10b981;">৳${ctx.unitPrice.toFixed(2)}</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://zevon.com/products/${ctx.productSlug}" style="display: inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; padding: 14px 32px; font-size: 15px; font-weight: 600; border-radius: 8px; letter-spacing: 0.5px;">Shop Now</a>
      </div>
      <p style="margin: 0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.5;">
        You received this notification because you subscribed to back-in-stock alerts for this item.<br>
        © ${new Date().getFullYear()} ZEVON Official.
      </p>
    </div>
  </div>
</body>
</html>
    `;

    try {
      if (this.transporter) {
        await this.transporter.sendMail({
          from: this.fromEmail,
          to: ctx.customerEmail,
          subject,
          html,
        });
        this.logger.log(
          `🔔 Back-in-stock email delivered to ${ctx.customerEmail} for variant ${ctx.sku}`,
        );
      } else {
        this.logger.log(
          `🔔 [DEV EMAIL LOG] Back-in-stock Alert for ${ctx.customerEmail}: ${ctx.productTitle} (${ctx.sku})`,
        );
      }
      return true;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `❌ Failed to deliver back-in-stock email to ${ctx.customerEmail}: ${errorMsg}`,
      );
      return false;
    }
  }

  /**
   * Referral System: Dispatches reward notification email when a referred friend completes an order.
   */
  async sendReferralRewardEmail(
    to: string,
    ctx: {
      referrerName: string;
      friendName: string;
      rewardPoints: number;
      rewardAmount: number;
    },
  ): Promise<boolean> {
    const subject = `🎉 You earned ৳${ctx.rewardAmount} in rewards! (Friend Referral)`;
    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 20px;">
  <div style="max-width: 600px; margin: auto; background: #1e293b; border-radius: 12px; padding: 30px; border: 1px solid #334155;">
    <h2 style="color: #10b981; margin-top: 0;">Referral Bonus Credited! 🎉</h2>
    <p>Hi ${ctx.referrerName},</p>
    <p>Great news! Your friend <strong>${ctx.friendName}</strong> just completed their first order on ZEVON.</p>
    <div style="background: #0f172a; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #94a3b8;">Reward Added to Your Wallet</p>
      <h1 style="margin: 8px 0; color: #10b981;">+${ctx.rewardPoints} Points (৳${ctx.rewardAmount})</h1>
    </div>
    <p>You can redeem your points anytime at checkout towards your next stylish outfit!</p>
    <p style="font-size: 12px; color: #64748b; margin-top: 30px;">© ${new Date().getFullYear()} ZEVON Official. All rights reserved.</p>
  </div>
</body>
</html>
    `;

    try {
      if (this.transporter) {
        await this.transporter.sendMail({
          from: this.fromEmail,
          to,
          subject,
          html,
        });
      } else {
        this.logger.log(
          `🎁 [DEV EMAIL LOG] Referral Reward to ${to}: +${ctx.rewardPoints} Points`,
        );
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Abandoned Cart Recovery: Dispatches recovery email with dynamic promo code.
   */
  async sendAbandonedCartEmail(
    to: string,
    ctx: {
      customerName: string;
      items: Array<{
        title: string;
        size: string;
        color: string;
        price: number;
        imageUrl?: string | null;
      }>;
      recoveryCouponCode: string;
      discountPercent: number;
      cartUrl?: string;
    },
  ): Promise<boolean> {
    const subject = `🛒 Did you forget something? Here is ${ctx.discountPercent}% off to complete your order!`;
    const itemsHtml = ctx.items
      .map(
        (i) => `
      <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #334155;">
        <div>
          <strong style="color: #ffffff;">${i.title}</strong>
          <div style="font-size: 12px; color: #94a3b8;">Size: ${i.size} | Color: ${i.color}</div>
        </div>
        <div style="color: #10b981; font-weight: 600;">৳${i.price.toFixed(2)}</div>
      </div>
    `,
      )
      .join('');

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 20px;">
  <div style="max-width: 600px; margin: auto; background: #1e293b; border-radius: 12px; padding: 30px; border: 1px solid #334155;">
    <h2 style="color: #38bdf8; margin-top: 0;">You left items in your shopping bag! 🛍️</h2>
    <p>Hi ${ctx.customerName},</p>
    <p>Your favorite picks are waiting for you. Complete your order today and enjoy an exclusive discount:</p>
    
    <div style="background: #0f172a; border: 2px dashed #38bdf8; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0;">
      <p style="margin: 0; font-size: 12px; color: #94a3b8;">Use promo code at checkout:</p>
      <h2 style="margin: 8px 0; color: #38bdf8; letter-spacing: 2px;">${ctx.recoveryCouponCode}</h2>
      <p style="margin: 0; font-size: 13px; color: #a7f3d0;">Save ${ctx.discountPercent}% off your cart!</p>
    </div>

    <div style="margin: 20px 0;">
      ${itemsHtml}
    </div>

    <div style="text-align: center; margin-top: 30px;">
      <a href="https://zevon.com/cart" style="background: #38bdf8; color: #0f172a; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 8px;">Complete My Order</a>
    </div>
    <p style="font-size: 12px; color: #64748b; margin-top: 30px; text-align: center;">© ${new Date().getFullYear()} ZEVON Official.</p>
  </div>
</body>
</html>
    `;

    try {
      if (this.transporter) {
        await this.transporter.sendMail({
          from: this.fromEmail,
          to,
          subject,
          html,
        });
      } else {
        this.logger.log(
          `🛒 [DEV EMAIL LOG] Abandoned Cart Recovery to ${to}: Code ${ctx.recoveryCouponCode}`,
        );
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Digital Gift Card: Delivers voucher code and personalized message to recipient.
   */
  async sendGiftCardEmail(
    to: string,
    ctx: {
      recipientName?: string;
      senderName?: string;
      code: string;
      balance: number;
      customMessage?: string;
      expiryDate?: string;
    },
  ): Promise<boolean> {
    const subject = `🎁 You received a ৳${ctx.balance} ZEVON Gift Card!`;
    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 20px;">
  <div style="max-width: 600px; margin: auto; background: #1e293b; border-radius: 12px; padding: 30px; border: 1px solid #334155;">
    <div style="background: linear-gradient(135deg, #ec4899, #8b5cf6); padding: 24px; border-radius: 10px; text-align: center; color: #ffffff;">
      <h1 style="margin: 0; font-size: 24px;">ZEVON GIFT CARD</h1>
      <h2 style="margin: 12px 0 0; font-size: 32px;">৳${ctx.balance.toFixed(2)}</h2>
    </div>

    <div style="padding: 20px 0;">
      <p>Hello${ctx.recipientName ? ` ${ctx.recipientName}` : ''},</p>
      <p>${ctx.senderName ? `<strong>${ctx.senderName}</strong> sent you a digital gift card!` : 'You received a digital gift card!'}</p>
      
      ${
        ctx.customMessage
          ? `<blockquote style="background: #0f172a; padding: 14px; border-left: 4px solid #ec4899; margin: 16px 0; font-style: italic; color: #cbd5e1;">"${ctx.customMessage}"</blockquote>`
          : ''
      }

      <div style="background: #0f172a; border: 1px solid #334155; padding: 16px; border-radius: 8px; text-align: center; margin: 24px 0;">
        <p style="margin: 0; font-size: 13px; color: #94a3b8;">Your Gift Card Voucher Code:</p>
        <h3 style="margin: 8px 0; color: #ec4899; letter-spacing: 2px; font-size: 20px;">${ctx.code}</h3>
        ${ctx.expiryDate ? `<p style="margin: 0; font-size: 12px; color: #64748b;">Expires: ${ctx.expiryDate}</p>` : ''}
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="https://zevon.com" style="background: #ec4899; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 8px;">Shop at ZEVON</a>
      </div>
    </div>
    <p style="font-size: 12px; color: #64748b; text-align: center;">© ${new Date().getFullYear()} ZEVON Official. All rights reserved.</p>
  </div>
</body>
</html>
    `;

    try {
      if (this.transporter) {
        await this.transporter.sendMail({
          from: this.fromEmail,
          to,
          subject,
          html,
        });
      } else {
        this.logger.log(
          `🎁 [DEV EMAIL LOG] Gift Card to ${to}: ${ctx.code} (৳${ctx.balance})`,
        );
      }
      return true;
    } catch {
      return false;
    }
  }
}
