import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GiftCardStatus } from '@prisma/client';

export class CreateGiftCardDto {
  @ApiProperty({
    example: 2000,
    description: 'Gift card balance in BDT',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'amount must be a valid number' })
  @IsPositive({ message: 'amount must be greater than 0' })
  @Min(1, { message: 'Minimum gift card balance is ৳1' })
  @IsNotEmpty()
  amount!: number;

  @ApiProperty({
    example: 'recipient@example.com',
    description: 'Email address of the gift recipient',
  })
  @IsEmail({}, { message: 'A valid recipient email is required' })
  @IsNotEmpty()
  recipientEmail!: string;

  @ApiPropertyOptional({
    example: 'Tahmid Khan',
    description: 'Name of the gift recipient',
  })
  @IsOptional()
  @IsString()
  recipientName?: string;

  @ApiPropertyOptional({
    example: 'ZEV-GIFT-8821-4829',
    description: 'Custom unique gift card code (auto-generated if empty)',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    example: 'Happy Birthday! Enjoy your shopping.',
    description: 'Personalized greeting message',
  })
  @IsOptional()
  @IsString()
  customMessage?: string;

  @ApiPropertyOptional({
    enum: GiftCardStatus,
    default: GiftCardStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(GiftCardStatus)
  status?: GiftCardStatus;

  @ApiPropertyOptional({
    example: '2027-12-31T23:59:59.999Z',
    description: 'Expiry timestamp',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Send delivery email notification to recipient immediately',
  })
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;
}
