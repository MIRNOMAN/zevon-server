import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApplyReferralDto {
  @ApiProperty({
    example: 'ZEV-NOMAN-4819',
    description: 'Referral code provided by your friend',
  })
  @IsString()
  @IsNotEmpty({ message: 'referralCode is required' })
  referralCode!: string;
}
