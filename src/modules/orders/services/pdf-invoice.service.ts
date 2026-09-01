import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';

export interface InvoiceItem {
  serial: number;
  productTitle: string;
  sku?: string | null;
  size?: string | null;
  color?: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface InvoiceAddress {
  fullName?: string;
  phone?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface InvoiceData {
  invoiceNumber: string;
  orderNumber: string;
  orderDate: Date | string;
  paymentStatus: string;
  paymentMethod: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  shippingAddress: InvoiceAddress;
  billingAddress?: InvoiceAddress | null;
  items: InvoiceItem[];
  financials: {
    subtotal: number;
    discountAmount: number;
    couponCode?: string | null;
    shippingCost: number;
    totalAmount: number;
    currency?: string;
  };
  courierName?: string | null;
  trackingNumber?: string | null;
}

@Injectable()
export class PdfInvoiceService {
  private readonly logger = new Logger(PdfInvoiceService.name);

  /**
   * Generates a branded, printable A4 PDF Invoice for an order.
   */
  async generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
    const barcodeBuffer = await this.generateBarcodeBuffer(data.orderNumber);

    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: {
        Title: `Invoice-${data.orderNumber}`,
        Author: 'ZEVON Lifestyle',
        Subject: `Official Tax Invoice for Order #${data.orderNumber}`,
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    const streamPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err: unknown) =>
        reject(err instanceof Error ? err : new Error(String(err))),
      );
    });

    try {
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 40;
      const printableWidth = pageWidth - margin * 2;

      // ── 1. Top Decorative Accent Bar ─────────────────────────────────
      doc.rect(margin, 20, printableWidth, 3).fill('#0f172a'); // Deep Slate/Black

      // ── 2. Header Section ───────────────────────────────────────────
      doc.y = 35;

      // Brand Title
      doc
        .font('Helvetica-Bold')
        .fontSize(22)
        .fillColor('#0f172a')
        .text('ZEVON', margin, 35, { characterSpacing: 2 });

      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#64748b')
        .text('PREMIUM APPAREL & LIFESTYLE', margin, 60, {
          characterSpacing: 1,
        });

      // Invoice Header Title (Right aligned)
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor('#0f172a')
        .text('TAX INVOICE', margin, 35, { align: 'right' });

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#475569')
        .text(`Invoice No: ${data.invoiceNumber}`, margin, 55, {
          align: 'right',
        })
        .text(`Order No: #${data.orderNumber}`, margin, 68, {
          align: 'right',
        })
        .text(
          `Date: ${new Date(data.orderDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}`,
          margin,
          81,
          { align: 'right' },
        );

      // ── 3. Badges (Payment Method & Status) ─────────────────────────
      const isPaid = data.paymentStatus === 'PAID';
      const badgeColor = isPaid ? '#059669' : '#d97706';
      const badgeText = `${data.paymentStatus} (${data.paymentMethod})`;

      doc
        .roundedRect(pageWidth - margin - 130, 96, 130, 16, 3)
        .fillOpacity(0.12)
        .fill(badgeColor);

      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillOpacity(1)
        .fillColor(badgeColor)
        .text(badgeText, pageWidth - margin - 130, 100, {
          width: 130,
          align: 'center',
        });

      // ── 4. Horizontal Divider ───────────────────────────────────────
      doc
        .moveTo(margin, 120)
        .lineTo(pageWidth - margin, 120)
        .lineWidth(0.75)
        .strokeColor('#e2e8f0')
        .stroke();

      // ── 5. Company & Customer Address Details ────────────────────────
      const addressTop = 130;
      const colWidth = (printableWidth - 20) / 3;

      // Col 1: Seller Details
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#0f172a')
        .text('SOLD BY:', margin, addressTop);

      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor('#334155')
        .text('ZEVON Lifestyle Limited', margin, addressTop + 14)
        .text('House 42, Road 11, Banani', margin, addressTop + 26)
        .text('Dhaka-1213, Bangladesh', margin, addressTop + 38)
        .text('BIN / Tax ID: 004829104-0101', margin, addressTop + 50)
        .text('support@zevon.com | +880 9612-000000', margin, addressTop + 62);

      // Col 2: Bill To
      const col2X = margin + colWidth + 10;
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#0f172a')
        .text('BILL TO:', col2X, addressTop);

      const billAddr = data.billingAddress || data.shippingAddress;
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor('#334155')
        .text(
          data.customer.name || billAddr.fullName || 'Valued Customer',
          col2X,
          addressTop + 14,
        )
        .text(billAddr.addressLine1 || 'N/A', col2X, addressTop + 26)
        .text(
          `${billAddr.city || ''}${billAddr.postalCode ? ` - ${billAddr.postalCode}` : ''}`,
          col2X,
          addressTop + 38,
        )
        .text(
          data.customer.phone || billAddr.phone || 'Phone: N/A',
          col2X,
          addressTop + 50,
        )
        .text(data.customer.email || 'Email: N/A', col2X, addressTop + 62);

      // Col 3: Ship To & Logistics
      const col3X = margin + (colWidth + 10) * 2;
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#0f172a')
        .text('SHIP TO:', col3X, addressTop);

      const shipAddr = data.shippingAddress;
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor('#334155')
        .text(
          shipAddr.fullName || data.customer.name || 'Valued Customer',
          col3X,
          addressTop + 14,
        )
        .text(shipAddr.addressLine1 || 'N/A', col3X, addressTop + 26)
        .text(
          `${shipAddr.city || ''}${shipAddr.postalCode ? ` - ${shipAddr.postalCode}` : ''}`,
          col3X,
          addressTop + 38,
        )
        .text(
          shipAddr.phone || data.customer.phone || 'Phone: N/A',
          col3X,
          addressTop + 50,
        )
        .text(
          `Courier: ${data.courierName || 'Standard Express'}`,
          col3X,
          addressTop + 62,
        );

      // ── 6. Items Table ──────────────────────────────────────────────
      const tableTop = 215;

      // Table Header Background
      doc.rect(margin, tableTop, printableWidth, 22).fill('#f1f5f9');

      // Table Headers
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#334155');

      doc.text('#', margin + 8, tableTop + 6, { width: 20 });
      doc.text('ITEM DESCRIPTION', margin + 30, tableTop + 6, { width: 220 });
      doc.text('SPEC / SKU', margin + 255, tableTop + 6, { width: 100 });
      doc.text('QTY', margin + 360, tableTop + 6, {
        width: 35,
        align: 'center',
      });
      doc.text('UNIT PRICE', margin + 400, tableTop + 6, {
        width: 55,
        align: 'right',
      });
      doc.text('TOTAL', margin + 460, tableTop + 6, {
        width: printableWidth - 460 + margin,
        align: 'right',
      });

      let currentY = tableTop + 24;

      // Line Items
      data.items.forEach((item, index) => {
        const rowBg = index % 2 === 1 ? '#f8fafc' : '#ffffff';
        doc.rect(margin, currentY, printableWidth, 26).fill(rowBg);

        doc.font('Helvetica').fontSize(8.5).fillColor('#1e293b');

        // Serial
        doc.text(String(item.serial), margin + 8, currentY + 7, {
          width: 20,
        });

        // Product Title
        doc
          .font('Helvetica-Bold')
          .text(item.productTitle, margin + 30, currentY + 4, {
            width: 220,
            ellipsis: true,
          });

        // Specs (Size / Color / SKU)
        const specs = [
          item.size ? `Size: ${item.size}` : null,
          item.color ? `Color: ${item.color}` : null,
        ]
          .filter(Boolean)
          .join(' | ');

        doc
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor('#64748b')
          .text(specs || item.sku || 'Standard', margin + 255, currentY + 8, {
            width: 100,
            ellipsis: true,
          });

        // Qty
        doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor('#1e293b')
          .text(String(item.quantity), margin + 360, currentY + 7, {
            width: 35,
            align: 'center',
          });

        // Unit Price
        doc.text(
          `৳${item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          margin + 400,
          currentY + 7,
          { width: 55, align: 'right' },
        );

        // Total Price
        doc
          .font('Helvetica-Bold')
          .text(
            `৳${item.lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            margin + 460,
            currentY + 7,
            { width: printableWidth - 460 + margin, align: 'right' },
          );

        // Subtle Bottom Border for Row
        doc
          .moveTo(margin, currentY + 26)
          .lineTo(pageWidth - margin, currentY + 26)
          .lineWidth(0.5)
          .strokeColor('#e2e8f0')
          .stroke();

        currentY += 26;
      });

      // ── 7. Financial Summary Box & Barcode ────────────────────────────
      const summaryTop = currentY + 15;

      // Left Side: Code128 Barcode & Order Number
      if (barcodeBuffer) {
        try {
          doc.image(barcodeBuffer, margin + 10, summaryTop, {
            width: 160,
            height: 42,
          });
          doc
            .font('Helvetica')
            .fontSize(7.5)
            .fillColor('#64748b')
            .text(
              `Scan to verify: #${data.orderNumber}`,
              margin + 10,
              summaryTop + 46,
              {
                width: 160,
                align: 'center',
              },
            );
        } catch {
          this.logger.warn(
            `Could not render barcode image into invoice for order #${data.orderNumber}`,
          );
        }
      }

      // Right Side: Calculation Totals Box
      const sumBoxWidth = 210;
      const sumBoxX = pageWidth - margin - sumBoxWidth;

      doc.roundedRect(sumBoxX, summaryTop, sumBoxWidth, 105, 4).fill('#f8fafc');

      doc
        .roundedRect(sumBoxX, summaryTop, sumBoxWidth, 105, 4)
        .lineWidth(0.75)
        .strokeColor('#cbd5e1')
        .stroke();

      let sumY = summaryTop + 8;

      const addSummaryRow = (
        label: string,
        val: string,
        bold = false,
        color = '#334155',
      ) => {
        doc
          .font(bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(bold ? 9.5 : 8.5)
          .fillColor(color);
        doc.text(label, sumBoxX + 12, sumY, { width: 100 });
        doc.text(val, sumBoxX + 110, sumY, { width: 88, align: 'right' });
        sumY += 16;
      };

      addSummaryRow(
        'Subtotal:',
        `৳${data.financials.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      );

      if (data.financials.discountAmount > 0) {
        const discountLabel = data.financials.couponCode
          ? `Discount (${data.financials.couponCode}):`
          : 'Discount:';
        addSummaryRow(
          discountLabel,
          `-৳${data.financials.discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          false,
          '#dc2626',
        );
      }

      addSummaryRow(
        'Shipping Fee:',
        data.financials.shippingCost === 0
          ? 'FREE'
          : `৳${data.financials.shippingCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      );

      // Divider in summary box
      doc
        .moveTo(sumBoxX + 10, sumY)
        .lineTo(sumBoxX + sumBoxWidth - 10, sumY)
        .lineWidth(0.5)
        .strokeColor('#cbd5e1')
        .stroke();
      sumY += 6;

      addSummaryRow(
        'Grand Total:',
        `৳${data.financials.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        true,
        '#0f172a',
      );

      // ── 8. Footer Notes & Return Policy ──────────────────────────────
      const footerY = pageHeight - 75;

      doc
        .moveTo(margin, footerY - 8)
        .lineTo(pageWidth - margin, footerY - 8)
        .lineWidth(0.5)
        .strokeColor('#e2e8f0')
        .stroke();

      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#0f172a')
        .text('TERMS & CONDITIONS / RETURN POLICY:', margin, footerY);

      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor('#64748b')
        .text(
          '• Items can be exchanged or returned within 14 days of delivery provided original tags and packaging are intact.',
          margin,
          footerY + 12,
        )
        .text(
          '• For support or inquiries, please contact care@zevon.com or visit www.zevon.com/support.',
          margin,
          footerY + 22,
        );

      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor('#94a3b8')
        .text(
          'This is a computer-generated tax invoice and requires no physical signature.',
          margin,
          footerY + 36,
          {
            align: 'center',
          },
        );

      doc.end();
      return await streamPromise;
    } catch (error) {
      doc.end();
      this.logger.error(
        `Error constructing PDF invoice for ${data.orderNumber}`,
        error,
      );
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Generates a high-density Code128 PNG barcode buffer.
   */
  private async generateBarcodeBuffer(text: string): Promise<Buffer | null> {
    try {
      return await bwipjs.toBuffer({
        bcid: 'code128',
        text: text.toUpperCase(),
        scale: 2,
        height: 10,
        includetext: true,
        textxalign: 'center',
      });
    } catch (error) {
      this.logger.error(
        `Failed to generate Code128 barcode for text: ${text}`,
        error,
      );
      return null;
    }
  }
}
