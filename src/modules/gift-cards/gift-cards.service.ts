import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { GiftCardStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import {
  PurchaseGiftCardDto,
  CheckBalanceDto,
  RedeemGiftCardDto,
  GiftCardQueryDto,
} from './dto/index.js';

@Injectable()
export class GiftCardsService {
  private readonly logger = new Logger(GiftCardsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Purchases a digital gift card, provisions a unique voucher code,
   * and emails the recipient with custom greeting notes.
   */
  async purchase(userId: string, dto: PurchaseGiftCardDto) {
    const { amount, recipientEmail, recipientName, customMessage } = dto;
    const cleanEmail = recipientEmail.trim().toLowerCase();

    // 1. Fetch Sender info
    const sender = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    // 2. Generate unique gift card code (e.g. ZEV-GIFT-8921-4829)
    const codePart1 = Math.floor(1000 + Math.random() * 9000);
    const codePart2 = Math.floor(1000 + Math.random() * 9000);
    const code = `ZEV-GIFT-${codePart1}-${codePart2}`;

    // 3. Expiry: 1 Year from purchase
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const giftCard = await this.prisma.giftCard.create({
      data: {
        code,
        initialBalance: new Prisma.Decimal(amount),
        currentBalance: new Prisma.Decimal(amount),
        senderId: userId,
        recipientEmail: cleanEmail,
        recipientName: recipientName ? recipientName.trim() : null,
        customMessage: customMessage ? customMessage.trim() : null,
        status: GiftCardStatus.ACTIVE,
        expiresAt,
      },
    });

    // 4. Dispatch Gift Card Delivery Email to Recipient
    await this.mailService.sendGiftCardEmail(cleanEmail, {
      recipientName: giftCard.recipientName || undefined,
      senderName: sender?.name || 'A generous friend',
      code: giftCard.code,
      balance: amount,
      customMessage: giftCard.customMessage || undefined,
      expiryDate: expiresAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    });

    this.logger.log(
      `🎁 Gift card created: ${code} (৳${amount}) for recipient ${cleanEmail}`,
    );

    return {
      message: `Digital gift card of ৳${amount} has been successfully sent to ${cleanEmail}!`,
      code: giftCard.code,
      initialBalance: Number(giftCard.initialBalance),
      currentBalance: Number(giftCard.currentBalance),
      recipientEmail: giftCard.recipientEmail,
      recipientName: giftCard.recipientName,
      status: giftCard.status,
      expiresAt: giftCard.expiresAt,
      createdAt: giftCard.createdAt,
    };
  }

  /**
   * Public: Check remaining balance and validity of a gift card voucher code.
   */
  async checkBalance(dto: CheckBalanceDto) {
    const cleanCode = dto.code.trim().toUpperCase();

    const giftCard = await this.prisma.giftCard.findUnique({
      where: { code: cleanCode },
    });

    if (!giftCard) {
      throw new NotFoundException(
        `Gift card voucher "${cleanCode}" was not found`,
      );
    }

    const isExpired = giftCard.expiresAt
      ? new Date() > giftCard.expiresAt
      : false;
    const currentBalanceNum = Number(giftCard.currentBalance);
    const isValid =
      giftCard.status === GiftCardStatus.ACTIVE &&
      currentBalanceNum > 0 &&
      !isExpired;

    return {
      code: giftCard.code,
      initialBalance: Number(giftCard.initialBalance),
      currentBalance: currentBalanceNum,
      status: giftCard.status,
      isExpired,
      isValid,
      expiresAt: giftCard.expiresAt,
      currency: 'BDT (৳)',
    };
  }

  /**
   * Redeem / Deduct balance from gift card voucher towards an order.
   */
  async redeem(userId: string, dto: RedeemGiftCardDto) {
    const { code, amount, orderId } = dto;
    const cleanCode = code.trim().toUpperCase();

    const giftCard = await this.prisma.giftCard.findUnique({
      where: { code: cleanCode },
    });

    if (!giftCard) {
      throw new NotFoundException(
        `Gift card voucher "${cleanCode}" was not found`,
      );
    }

    if (giftCard.status !== GiftCardStatus.ACTIVE) {
      throw new BadRequestException(
        `This gift card is ${giftCard.status.toLowerCase()} and cannot be used`,
      );
    }

    if (giftCard.expiresAt && new Date() > giftCard.expiresAt) {
      throw new BadRequestException('This gift card has expired');
    }

    const currentBalance = Number(giftCard.currentBalance);
    if (currentBalance <= 0) {
      throw new BadRequestException('This gift card has a zero balance');
    }

    // Deduct up to available balance or requested amount
    const deductionAmount = Math.min(amount, currentBalance);
    const newBalance = currentBalance - deductionAmount;
    const newStatus =
      newBalance === 0 ? GiftCardStatus.REDEEMED : GiftCardStatus.ACTIVE;

    const [updatedCard, redemption] = await this.prisma.$transaction([
      this.prisma.giftCard.update({
        where: { id: giftCard.id },
        data: {
          currentBalance: new Prisma.Decimal(newBalance),
          status: newStatus,
        },
      }),
      this.prisma.giftCardRedemption.create({
        data: {
          giftCardId: giftCard.id,
          userId,
          orderId: orderId || null,
          amountDeducted: new Prisma.Decimal(deductionAmount),
          balanceAfter: new Prisma.Decimal(newBalance),
        },
      }),
    ]);

    this.logger.log(
      `💸 Gift card ${cleanCode} redeemed: -৳${deductionAmount} (Remaining: ৳${newBalance}) by user ${userId}`,
    );

    return {
      code: updatedCard.code,
      amountDeducted: deductionAmount,
      remainingBalance: newBalance,
      status: updatedCard.status,
      redemptionId: redemption.id,
    };
  }

  /**
   * Admin: List all digital gift cards with filters and search.
   */
  async findAll(query: GiftCardQueryDto) {
    const { page = 1, limit = 20, status, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.GiftCardWhereInput = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              { recipientEmail: { contains: search, mode: 'insensitive' } },
              { recipientName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, cards] = await Promise.all([
      this.prisma.giftCard.count({ where }),
      this.prisma.giftCard.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { name: true, email: true } },
          _count: { select: { redemptions: true } },
        },
      }),
    ]);

    return {
      giftCards: cards.map((c) => ({
        ...c,
        initialBalance: Number(c.initialBalance),
        currentBalance: Number(c.currentBalance),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
