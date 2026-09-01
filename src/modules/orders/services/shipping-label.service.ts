import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';

export interface ShippingLabelData {
  orderNumber: string;
  trackingNumber: string;
  courierName: string;
  shippingZoneName?: string;
  recipient: {
    fullName: string;
    phone: string;
    email?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state?: string;
    postalCode?: string;
  };
  sender: {
    companyName: string;
    hubName: string;
    address: string;
    city: string;
    phone: string;
  };
  paymentMethod: string;
  paymentStatus: string;
  codAmount: number;
  totalItemsCount: number;
  packageWeightKg?: number;
  createdAt: Date | string;
  notes?: string | null;
}

@Injectable()
export class ShippingLabelService {
  private readonly logger = new Logger(ShippingLabelService.name);

  // Standard 4x6 inch thermal shipping label dimensions in PostScript points (72 pt/inch)
  // 4 inches = 288 pt, 6 inches = 432 pt
  private readonly LABEL_WIDTH = 288;
  private readonly LABEL_HEIGHT = 432;
  private readonly MARGIN = 12;

  /**
   * Generates a single 4x6" Thermal Shipping Label PDF with Code128 barcodes.
   */
  async generateShippingLabelPdf(data: ShippingLabelData): Promise<Buffer> {
    return this.generateBulkShippingLabelsPdf([data]);
  }

  /**
   * Generates a consolidated multi-page 4x6" Thermal Shipping Labels PDF for bulk printing.
   */
  async generateBulkShippingLabelsPdf(
    labels: ShippingLabelData[],
  ): Promise<Buffer> {
    if (!labels || labels.length === 0) {
      throw new Error('At least one shipping label payload is required');
    }

    const doc = new PDFDocument({
      size: [this.LABEL_WIDTH, this.LABEL_HEIGHT],
      margin: this.MARGIN,
      autoFirstPage: false,
      info: {
        Title: `Shipping-Labels-${Date.now()}`,
        Author: 'ZEVON Logistics & Fulfillment',
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
      for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        if (!label) continue;
        doc.addPage({
          size: [this.LABEL_WIDTH, this.LABEL_HEIGHT],
          margin: this.MARGIN,
        });

        await this.renderSingleLabelPage(doc, label, i + 1, labels.length);
      }

      doc.end();
      return await streamPromise;
    } catch (error) {
      doc.end();
      this.logger.error('Failed to generate bulk shipping labels PDF', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Renders a single 4x6" thermal label onto the active PDFDocument page.
   */
  private async renderSingleLabelPage(
    doc: PDFKit.PDFDocument,
    data: ShippingLabelData,
    currentPage: number,
    totalPages: number,
  ): Promise<void> {
    const m = this.MARGIN;
    const w = this.LABEL_WIDTH - m * 2; // 264 pt printable width

    // Outer Border
    doc
      .rect(m, m, w, this.LABEL_HEIGHT - m * 2)
      .lineWidth(1.5)
      .strokeColor('#000000')
      .stroke();

    // ── 1. Top Courier & Logistics Header ────────────────────────────
    doc.rect(m, m, w, 36).fill('#000000');

    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor('#ffffff')
      .text(
        (data.courierName || 'STANDARD EXPRESS').toUpperCase(),
        m + 8,
        m + 6,
        { width: w - 80 },
      );

    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor('#ffffff')
      .text(data.shippingZoneName || 'STANDARD DELIVERY', m + 8, m + 22);

    // Page indicator / Dispatch date
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#ffffff')
      .text(`${currentPage}/${totalPages}`, m + w - 70, m + 7, {
        width: 62,
        align: 'right',
      })
      .font('Helvetica')
      .fontSize(7)
      .text(
        new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        m + w - 70,
        m + 21,
        { width: 62, align: 'right' },
      );

    // ── 2. Primary Tracking Barcode ──────────────────────────────────
    const trackingCode = data.trackingNumber || data.orderNumber;
    const trackingBarcodeBuffer = await this.generateBarcodeBuffer(
      trackingCode,
      12,
    );

    const barcodeY = m + 40;
    if (trackingBarcodeBuffer) {
      try {
        doc.image(trackingBarcodeBuffer, m + 12, barcodeY, {
          width: w - 24,
          height: 48,
        });
      } catch {
        this.logger.warn(`Could not draw tracking barcode for ${trackingCode}`);
      }
    }

    // Divider
    let currentY = barcodeY + 54;
    this.drawHDivider(doc, m, currentY, w);

    // ── 3. Sender (FROM) Section ─────────────────────────────────────
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor('#000000')
      .text('FROM / RETURN TO:', m + 6, currentY + 4);

    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#222222')
      .text(
        `${data.sender.companyName} (${data.sender.hubName}) | Ph: ${data.sender.phone}`,
        m + 6,
        currentY + 13,
        { width: w - 12, ellipsis: true },
      )
      .text(
        `${data.sender.address}, ${data.sender.city}`,
        m + 6,
        currentY + 22,
        {
          width: w - 12,
          ellipsis: true,
        },
      );

    // Divider
    currentY += 32;
    this.drawHDivider(doc, m, currentY, w);

    // ── 4. Recipient (SHIP TO) Section ───────────────────────────────
    doc.rect(m + 1, currentY + 1, w - 2, 78).fill('#f8f9fa');

    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#000000')
      .text('DELIVER TO (RECIPIENT):', m + 6, currentY + 5);

    // Customer Name (Bold & Large)
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#000000')
      .text(data.recipient.fullName || 'Customer', m + 6, currentY + 16, {
        width: w - 12,
      });

    // Phone Number (High prominence for delivery rider)
    doc
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .fillColor('#000000')
      .text(`PHONE: ${data.recipient.phone}`, m + 6, currentY + 30);

    // Address
    const fullAddress = [
      data.recipient.addressLine1,
      data.recipient.addressLine2,
      data.recipient.city,
      data.recipient.postalCode
        ? `Postal Code: ${data.recipient.postalCode}`
        : '',
    ]
      .filter(Boolean)
      .join(', ');

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#111111')
      .text(fullAddress, m + 6, currentY + 44, {
        width: w - 12,
        height: 32,
        ellipsis: true,
      });

    // Divider
    currentY += 80;
    this.drawHDivider(doc, m, currentY, w);

    // ── 5. Payment & COD Amount Box (Critical) ───────────────────────
    const isCOD =
      data.paymentMethod === 'COD' ||
      data.paymentStatus === 'PENDING' ||
      data.codAmount > 0;

    const codBoxHeight = 44;

    if (isCOD && data.codAmount > 0) {
      doc
        .rect(m + 4, currentY + 4, w - 8, codBoxHeight - 8)
        .lineWidth(1.5)
        .strokeColor('#000000')
        .stroke();

      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#000000')
        .text('CASH ON DELIVERY (COLLECT AMOUNT):', m + 8, currentY + 8);

      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .fillColor('#000000')
        .text(
          `৳ ${data.codAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          m + 8,
          currentY + 20,
          { width: w - 16, align: 'center' },
        );
    } else {
      doc.rect(m + 4, currentY + 4, w - 8, codBoxHeight - 8).fill('#000000');

      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#ffffff')
        .text('PREPAID PARCEL - DO NOT COLLECT CASH', m + 8, currentY + 14, {
          width: w - 16,
          align: 'center',
        });
    }

    currentY += codBoxHeight;
    this.drawHDivider(doc, m, currentY, w);

    // ── 6. Order Reference & Secondary Barcode ────────────────────────
    const orderBarcodeBuffer = await this.generateBarcodeBuffer(
      data.orderNumber,
      9,
    );

    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#000000')
      .text(`ORDER NO: #${data.orderNumber}`, m + 6, currentY + 5);

    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor('#333333')
      .text(`Items: ${data.totalItemsCount} pcs`, m + w - 70, currentY + 5, {
        width: 64,
        align: 'right',
      });

    if (orderBarcodeBuffer) {
      try {
        doc.image(orderBarcodeBuffer, m + 14, currentY + 16, {
          width: w - 28,
          height: 34,
        });
      } catch {
        this.logger.warn(
          `Could not draw order barcode for #${data.orderNumber}`,
        );
      }
    }

    currentY += 56;
    this.drawHDivider(doc, m, currentY, w);

    // ── 7. Instructions & Footer ─────────────────────────────────────
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor('#000000')
      .text(
        'FRAGILE / HANDLE WITH CARE • APPAREL DISPATCH',
        m + 6,
        currentY + 5,
        {
          width: w - 12,
          align: 'center',
        },
      );

    doc
      .font('Helvetica')
      .fontSize(6.5)
      .fillColor('#444444')
      .text(
        'If parcel is open or seal is broken, verify with recipient before delivery.',
        m + 6,
        currentY + 15,
        { width: w - 12, align: 'center' },
      );
  }

  private drawHDivider(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    w: number,
  ): void {
    doc
      .moveTo(x, y)
      .lineTo(x + w, y)
      .lineWidth(1)
      .strokeColor('#000000')
      .stroke();
  }

  /**
   * Generates Code128 PNG barcode buffer with specified height.
   */
  private async generateBarcodeBuffer(
    text: string,
    height: number,
  ): Promise<Buffer | null> {
    try {
      return await bwipjs.toBuffer({
        bcid: 'code128',
        text: text.toUpperCase(),
        scale: 2,
        height,
        includetext: true,
        textxalign: 'center',
      });
    } catch (error) {
      this.logger.error(
        `Failed to generate Code128 barcode for ${text}`,
        error,
      );
      return null;
    }
  }
}
