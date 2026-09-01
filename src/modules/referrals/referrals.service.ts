import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ReferralStatus, PointTransactionType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { LoyaltyService } from '../loyalty/loyalty.service.js';

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  // 50 Points = ৳500 BDT reward per referral
  private readonly REFERRAL_REWARD_POINTS = 50;
  private readonly REFERRAL_REWARD_BDT = 500;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  /**
   * Retrieves or initializes customer referral code, shareable link, and earnings.
   */
  async getReferralStats(userId: string) {
    let user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, referralCode: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Generate unique code if not assigned yet
    if (!user.referralCode) {
      const sanitizedName =
        user.name
          .replace(/[^a-zA-Z]/g, '')
          .toUpperCase()
          .slice(0, 5) || 'USER';
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const generatedCode = `ZEV-${sanitizedName}-${randomSuffix}`;

      user = await this.prisma.user.update({
        where: { id: userId },
        data: { referralCode: generatedCode },
        select: { id: true, name: true, referralCode: true },
      });
    }

    const [totalInvited, totalRewarded] = await Promise.all([
      this.prisma.referral.count({ where: { referrerId: userId } }),
      this.prisma.referral.count({
        where: { referrerId: userId, status: ReferralStatus.REWARDED },
      }),
    ]);

    const totalEarnedPoints = totalRewarded * this.REFERRAL_REWARD_POINTS;
    const totalEarnedBDT = totalRewarded * this.REFERRAL_REWARD_BDT;

    return {
      referralCode: user.referralCode,
      referralLink: `https://zevon.com/register?ref=${user.referralCode}`,
      program: {
        giveRewardBDT: this.REFERRAL_REWARD_BDT,
        getRewardBDT: this.REFERRAL_REWARD_BDT,
        pointsEquivalent: this.REFERRAL_REWARD_POINTS,
      },
      stats: {
        totalFriendsInvited: totalInvited,
        successfulOrders: totalRewarded,
        totalPointsEarned: totalEarnedPoints,
        totalCashValueBDT: totalEarnedBDT,
      },
    };
  }

  /**
   * Applies a friend's referral code to the referee's account upon joining.
   */
  async applyReferralCode(refereeUserId: string, referralCode: string) {
    const cleanCode = referralCode.trim().toUpperCase();

    // 1. Verify Referrer exists
    const referrer = await this.prisma.user.findUnique({
      where: { referralCode: cleanCode },
    });

    if (!referrer) {
      throw new NotFoundException(`Referral code "${cleanCode}" is invalid`);
    }

    if (referrer.id === refereeUserId) {
      throw new BadRequestException('You cannot refer yourself');
    }

    // 2. Verify Referee hasn't already used a referral code
    const existingReferee = await this.prisma.user.findUnique({
      where: { id: refereeUserId },
      select: { referredById: true },
    });

    if (existingReferee?.referredById) {
      throw new BadRequestException(
        'A referral code has already been applied to your account',
      );
    }

    // 3. Link Referee to Referrer
    await this.prisma.user.update({
      where: { id: refereeUserId },
      data: { referredById: referrer.id },
    });

    // 4. Create Pending Referral record
    const referral = await this.prisma.referral.upsert({
      where: { refereeId: refereeUserId },
      create: {
        referrerId: referrer.id,
        refereeId: refereeUserId,
        status: ReferralStatus.PENDING,
        rewardAmount: this.REFERRAL_REWARD_BDT,
      },
      update: {
        referrerId: referrer.id,
      },
    });

    this.logger.log(
      `🤝 Referral applied: ${refereeUserId} referred by ${referrer.name} (${cleanCode})`,
    );

    return {
      applied: true,
      message: `Referral code applied! You will receive ৳${this.REFERRAL_REWARD_BDT} bonus on your first completed order.`,
      referrerName: referrer.name,
      referralId: referral.id,
    };
  }

  /**
   * Triggered when a referee completes their first order:
   * Credits wallet reward points to both referrer and referee, and dispatches email.
   */
  async rewardReferralOnFirstOrder(refereeUserId: string, orderNumber: string) {
    const referral = await this.prisma.referral.findUnique({
      where: { refereeId: refereeUserId },
      include: {
        referrer: { select: { id: true, name: true, email: true } },
        referee: { select: { id: true, name: true, email: true } },
      },
    });

    if (!referral || referral.status === ReferralStatus.REWARDED) {
      return { rewarded: false };
    }

    // 1. Credit Referrer Wallet
    await this.loyaltyService.adjustPoints(referral.referrerId, {
      userId: referral.referrerId,
      amount: this.REFERRAL_REWARD_POINTS,
      type: PointTransactionType.REFERRAL_BONUS,
      reason: `Referral reward for ${referral.referee.name}'s first order #${orderNumber}`,
    });

    // 2. Credit Referee Wallet
    await this.loyaltyService.adjustPoints(referral.refereeId, {
      userId: referral.refereeId,
      amount: this.REFERRAL_REWARD_POINTS,
      type: PointTransactionType.REFERRAL_BONUS,
      reason: `Welcome bonus for placing your first order #${orderNumber}`,
    });

    // 3. Mark Referral as REWARDED
    await this.prisma.referral.update({
      where: { id: referral.id },
      data: {
        status: ReferralStatus.REWARDED,
        rewardedAt: new Date(),
      },
    });

    // 4. Send Reward Notification Email to Referrer
    await this.mailService.sendReferralRewardEmail(referral.referrer.email, {
      referrerName: referral.referrer.name,
      friendName: referral.referee.name,
      rewardPoints: this.REFERRAL_REWARD_POINTS,
      rewardAmount: this.REFERRAL_REWARD_BDT,
    });

    this.logger.log(
      `🎉 Referral rewarded: Referrer ${referral.referrer.email} & Referee ${referral.referee.email} received +${this.REFERRAL_REWARD_POINTS} pts`,
    );

    return {
      rewarded: true,
      pointsGiven: this.REFERRAL_REWARD_POINTS,
      cashValueBDT: this.REFERRAL_REWARD_BDT,
    };
  }
}
