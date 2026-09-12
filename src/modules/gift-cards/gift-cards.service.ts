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
  CreateGiftCardDto,
  UpdateGiftCardDto,
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
   * Helper to format Decimal fields to standard numbers
   */
  private formatCard(card: any) {
    if (!card) return null;
    return {
      ...card,
      initialBalance: Number(card.initialBalance),
      currentBalance: Number(card.currentBalance),
      redemptions: card.redemptions
        ? card.redemptions.map((r: any) => ({
            ...r,
            amountDeducted: Number(r.amountDeducted),
            balanceAfter: Number(r.balanceAfter),
          }))
        : undefined,
    };
  }

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
      include: {
        sender: { select: { name: true, email: true } },
      },
    });

    // 4. Dispatch Gift Card Delivery Email to Recipient
    try {
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
    } catch (err) {
      this.logger.warn(`Failed to dispatch gift card email: ${(err as Error).message}`);
    }

    this.logger.log(
      `🎁 Gift card created: ${code} (৳${amount}) for recipient ${cleanEmail}`,
    );

    return {
      message: `Digital gift card of ৳${amount} has been successfully sent to ${cleanEmail}!`,
      ...this.formatCard(giftCard),
      giftCard: this.formatCard(giftCard),
    };
  }

  /**
   * Admin: Issue a new digital gift card directly
   */
  async create(userId: string | undefined, dto: CreateGiftCardDto) {
    const {
      amount,
      recipientEmail,
      recipientName,
      customMessage,
      code: customCode,
      status = GiftCardStatus.ACTIVE,
      expiresAt: customExpiresAt,
      sendEmail = true,
    } = dto;

    const cleanEmail = recipientEmail.trim().toLowerCase();

    // 1. Generate or format voucher code
    let code: string;
    if (customCode && customCode.trim()) {
      code = customCode.trim().toUpperCase();
      const existing = await this.prisma.giftCard.findUnique({
        where: { code },
      });
      if (existing) {
        throw new BadRequestException(`Gift card code "${code}" is already in use`);
      }
    } else {
      const codePart1 = Math.floor(1000 + Math.random() * 9000);
      const codePart2 = Math.floor(1000 + Math.random() * 9000);
      code = `ZEV-GIFT-${codePart1}-${codePart2}`;
    }

    // 2. Expiry calculation
    let expiresAt: Date | null = null;
    if (customExpiresAt) {
      expiresAt = new Date(customExpiresAt);
    } else {
      expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }

    // 3. Sender info
    let senderName = 'ZEVON Official';
    if (userId) {
      const sender = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });
      if (sender?.name) senderName = sender.name;
    }

    const giftCard = await this.prisma.giftCard.create({
      data: {
        code,
        initialBalance: new Prisma.Decimal(amount),
        currentBalance: new Prisma.Decimal(amount),
        senderId: userId || null,
        recipientEmail: cleanEmail,
        recipientName: recipientName ? recipientName.trim() : null,
        customMessage: customMessage ? customMessage.trim() : null,
        status,
        expiresAt,
      },
      include: {
        sender: { select: { id: true, name: true, email: true } },
        _count: { select: { redemptions: true } },
      },
    });

    // 4. Optionally send email
    if (sendEmail) {
      try {
        await this.mailService.sendGiftCardEmail(cleanEmail, {
          recipientName: giftCard.recipientName || undefined,
          senderName,
          code: giftCard.code,
          balance: amount,
          customMessage: giftCard.customMessage || undefined,
          expiryDate: expiresAt
            ? expiresAt.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })
            : 'No Expiration',
        });
      } catch (err) {
        this.logger.warn(`Failed to dispatch gift card email: ${(err as Error).message}`);
      }
    }

    this.logger.log(`🎁 Admin issued gift card: ${code} (৳${amount}) to ${cleanEmail}`);

    return this.formatCard(giftCard);
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
          sender: { select: { id: true, name: true, email: true } },
          _count: { select: { redemptions: true } },
        },
      }),
    ]);

    return {
      giftCards: cards.map((c) => this.formatCard(c)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin: Get single gift card by ID with detailed redemptions
   */
  async findOne(id: string) {
    const giftCard = await this.prisma.giftCard.findUnique({
      where: { id },
      include: {
        sender: { select: { id: true, name: true, email: true } },
        redemptions: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { redemptions: true } },
      },
    });

    if (!giftCard) {
      throw new NotFoundException(`Gift card with ID "${id}" not found`);
    }

    return this.formatCard(giftCard);
  }

  /**
   * Admin: Update gift card details
   */
  async update(id: string, dto: UpdateGiftCardDto) {
    const existing = await this.prisma.giftCard.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Gift card with ID "${id}" not found`);
    }

    if (dto.code && dto.code.trim().toUpperCase() !== existing.code) {
      const duplicate = await this.prisma.giftCard.findUnique({
        where: { code: dto.code.trim().toUpperCase() },
      });
      if (duplicate && duplicate.id !== id) {
        throw new BadRequestException(`Gift card code "${dto.code}" is already in use`);
      }
    }

    const updated = await this.prisma.giftCard.update({
      where: { id },
      data: {
        code: dto.code ? dto.code.trim().toUpperCase() : undefined,
        initialBalance:
          dto.initialBalance !== undefined
            ? new Prisma.Decimal(dto.initialBalance)
            : undefined,
        currentBalance:
          dto.currentBalance !== undefined
            ? new Prisma.Decimal(dto.currentBalance)
            : undefined,
        recipientEmail: dto.recipientEmail
          ? dto.recipientEmail.trim().toLowerCase()
          : undefined,
        recipientName:
          dto.recipientName !== undefined
            ? dto.recipientName
              ? dto.recipientName.trim()
              : null
            : undefined,
        customMessage:
          dto.customMessage !== undefined
            ? dto.customMessage
              ? dto.customMessage.trim()
              : null
            : undefined,
        status: dto.status !== undefined ? dto.status : undefined,
        expiresAt:
          dto.expiresAt !== undefined
            ? dto.expiresAt
              ? new Date(dto.expiresAt)
              : null
            : undefined,
      },
      include: {
        sender: { select: { id: true, name: true, email: true } },
        _count: { select: { redemptions: true } },
      },
    });

    this.logger.log(`Gift card ${updated.code} updated by admin`);
    return this.formatCard(updated);
  }

  /**
   * Admin: Toggle status (ACTIVE <-> DISABLED)
   */
  async toggleStatus(id: string) {
    const existing = await this.prisma.giftCard.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Gift card with ID "${id}" not found`);
    }

    const newStatus =
      existing.status === GiftCardStatus.ACTIVE
        ? GiftCardStatus.DISABLED
        : GiftCardStatus.ACTIVE;

    const updated = await this.prisma.giftCard.update({
      where: { id },
      data: { status: newStatus },
      include: {
        sender: { select: { id: true, name: true, email: true } },
        _count: { select: { redemptions: true } },
      },
    });

    return this.formatCard(updated);
  }

  /**
   * Admin: Delete gift card
   */
  async remove(id: string) {
    const existing = await this.prisma.giftCard.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Gift card with ID "${id}" not found`);
    }

    await this.prisma.giftCard.delete({
      where: { id },
    });

    this.logger.log(`Gift card ${existing.code} deleted`);
    return {
      message: `Gift card ${existing.code} deleted successfully`,
    };
  }
}
