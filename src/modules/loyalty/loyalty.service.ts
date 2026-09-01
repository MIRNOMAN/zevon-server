import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { CustomerTier, PointTransactionType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { AdjustPointsDto } from './dto/index.js';

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  // Tier configuration rules
  private readonly tierConfig = {
    [CustomerTier.BRONZE]: {
      name: 'Bronze',
      minSpend: 0,
      nextTierSpend: 5000,
      multiplier: 1.0, // 100 BDT = 1 Point
      color: '#cd7f32',
    },
    [CustomerTier.SILVER]: {
      name: 'Silver',
      minSpend: 5000,
      nextTierSpend: 20000,
      multiplier: 1.25, // 100 BDT = 1.25 Points
      color: '#c0c0c0',
    },
    [CustomerTier.GOLD]: {
      name: 'Gold',
      minSpend: 20000,
      nextTierSpend: 50000,
      multiplier: 1.5, // 100 BDT = 1.5 Points
      color: '#ffd700',
    },
    [CustomerTier.PLATINUM]: {
      name: 'Platinum',
      minSpend: 50000,
      nextTierSpend: null,
      multiplier: 2.0, // 100 BDT = 2.0 Points
      color: '#e5e4e2',
    },
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves or initializes customer loyalty wallet account with tier and ledger.
   */
  async getAccount(userId: string) {
    let account = await this.prisma.loyaltyAccount.findUnique({
      where: { userId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!account) {
      account = await this.prisma.loyaltyAccount.create({
        data: {
          userId,
          pointsBalance: 50, // 50 Welcome bonus points!
          lifetimePointsEarned: 50,
          tier: CustomerTier.BRONZE,
          transactions: {
            create: {
              amount: 50,
              type: PointTransactionType.WELCOME_BONUS,
              description:
                'Welcome Bonus: 50 points credited on joining ZEVON Rewards!',
            },
          },
        },
        include: {
          transactions: true,
        },
      });
    }

    const tierInfo = this.tierConfig[account.tier];
    const lifetimeSpentNum = Number(account.lifetimeSpent);

    let progressToNextTier = 100;
    let nextTierName: string | null = null;
    let amountNeededForNextTier = 0;

    if (tierInfo.nextTierSpend) {
      const currentTierMin = tierInfo.minSpend;
      const targetSpend = tierInfo.nextTierSpend;
      amountNeededForNextTier = Math.max(0, targetSpend - lifetimeSpentNum);
      progressToNextTier = Math.min(
        100,
        Math.floor(
          ((lifetimeSpentNum - currentTierMin) /
            (targetSpend - currentTierMin)) *
            100,
        ),
      );
      nextTierName =
        account.tier === CustomerTier.BRONZE
          ? 'Silver'
          : account.tier === CustomerTier.SILVER
            ? 'Gold'
            : 'Platinum';
    }

    return {
      pointsBalance: account.pointsBalance,
      pointsValueBDT: account.pointsBalance, // 1 Point = 1 BDT
      lifetimePointsEarned: account.lifetimePointsEarned,
      lifetimeSpent: lifetimeSpentNum,
      tier: account.tier,
      tierDetails: {
        name: tierInfo.name,
        multiplier: tierInfo.multiplier,
        color: tierInfo.color,
        progressPercentage: Math.max(0, progressToNextTier),
        nextTierName,
        amountNeededForNextTier,
      },
      recentTransactions: account.transactions.map((t) => ({
        id: t.id,
        amount: t.amount,
        type: t.type,
        description: t.description,
        referenceId: t.referenceId,
        createdAt: t.createdAt,
      })),
    };
  }

  /**
   * Awards reward points upon order payment completion with tier multiplier.
   */
  async awardPurchasePoints(
    userId: string,
    orderAmount: number,
    orderId: string,
  ) {
    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { userId },
    });
    const currentTier = account?.tier || CustomerTier.BRONZE;
    const multiplier = this.tierConfig[currentTier].multiplier;

    // 100 BDT spent = 1 Point * Tier Multiplier
    const earnedPoints = Math.max(
      1,
      Math.floor((orderAmount / 100) * multiplier),
    );
    const newLifetimeSpent = Number(account?.lifetimeSpent || 0) + orderAmount;

    // Evaluate Tier Promotion
    let newTier = currentTier;
    if (newLifetimeSpent >= 50000) {
      newTier = CustomerTier.PLATINUM;
    } else if (newLifetimeSpent >= 20000) {
      newTier = CustomerTier.GOLD;
    } else if (newLifetimeSpent >= 5000) {
      newTier = CustomerTier.SILVER;
    }

    const updatedAccount = await this.prisma.loyaltyAccount.upsert({
      where: { userId },
      create: {
        userId,
        pointsBalance: earnedPoints,
        lifetimePointsEarned: earnedPoints,
        lifetimeSpent: new Prisma.Decimal(orderAmount),
        tier: newTier,
        transactions: {
          create: {
            amount: earnedPoints,
            type: PointTransactionType.EARNED,
            description: `Earned ${earnedPoints} points on Order #${orderId}`,
            referenceId: orderId,
          },
        },
      },
      update: {
        pointsBalance: { increment: earnedPoints },
        lifetimePointsEarned: { increment: earnedPoints },
        lifetimeSpent: { increment: new Prisma.Decimal(orderAmount) },
        tier: newTier,
        transactions: {
          create: {
            amount: earnedPoints,
            type: PointTransactionType.EARNED,
            description: `Earned ${earnedPoints} points on Order #${orderId}`,
            referenceId: orderId,
          },
        },
      },
    });

    this.logger.log(
      `⭐ Awarded ${earnedPoints} points to user ${userId} for Order ${orderId} (Tier: ${newTier})`,
    );

    return {
      earnedPoints,
      newPointsBalance: updatedAccount.pointsBalance,
      tier: updatedAccount.tier,
    };
  }

  /**
   * Redeem loyalty points for checkout discounts.
   */
  async redeemPoints(userId: string, pointsToRedeem: number, orderId?: string) {
    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { userId },
    });

    if (!account || account.pointsBalance < pointsToRedeem) {
      throw new BadRequestException(
        `Insufficient reward points. Current balance: ${account?.pointsBalance || 0} points.`,
      );
    }

    const updated = await this.prisma.loyaltyAccount.update({
      where: { userId },
      data: {
        pointsBalance: { decrement: pointsToRedeem },
        transactions: {
          create: {
            amount: -pointsToRedeem,
            type: PointTransactionType.REDEEMED,
            description: `Redeemed ${pointsToRedeem} points for ৳${pointsToRedeem} discount at checkout`,
            referenceId: orderId,
          },
        },
      },
    });

    this.logger.log(`💸 User ${userId} redeemed ${pointsToRedeem} points`);

    return {
      pointsRedeemed: pointsToRedeem,
      discountAmountBDT: pointsToRedeem,
      newBalance: updated.pointsBalance,
    };
  }

  /**
   * Admin: Manual point adjustment with audit trail.
   */
  async adjustPoints(adminUserId: string, dto: AdjustPointsDto) {
    const {
      userId,
      amount,
      type = PointTransactionType.MANUAL_ADJUSTMENT,
      reason,
    } = dto;

    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { userId },
    });

    if (!account && amount < 0) {
      throw new BadRequestException(
        'Cannot deduct points from non-existent loyalty account',
      );
    }

    const updated = await this.prisma.loyaltyAccount.upsert({
      where: { userId },
      create: {
        userId,
        pointsBalance: Math.max(0, amount),
        lifetimePointsEarned: Math.max(0, amount),
        transactions: {
          create: {
            amount,
            type,
            description: `Admin adjustment: ${reason}`,
            referenceId: adminUserId,
          },
        },
      },
      update: {
        pointsBalance: { increment: amount },
        ...(amount > 0 ? { lifetimePointsEarned: { increment: amount } } : {}),
        transactions: {
          create: {
            amount,
            type,
            description: `Admin adjustment: ${reason}`,
            referenceId: adminUserId,
          },
        },
      },
    });

    return {
      userId,
      adjustedAmount: amount,
      newBalance: updated.pointsBalance,
      reason,
    };
  }
}
