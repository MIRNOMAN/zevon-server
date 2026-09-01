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
    this.fromEmail =
      this.configService.get<string>(
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
  async sendOrderPaymentSuccessEmail(context: PaymentEmailContext): Promise<boolean> {
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
}
