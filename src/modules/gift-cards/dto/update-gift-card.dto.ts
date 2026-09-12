import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { GiftCardStatus } from '@prisma/client';

export class UpdateGiftCardDto {
  @ApiPropertyOptional({
    example: 'ZEV-GIFT-8821-4829',
    description: 'Unique gift card voucher code',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    example: 2000,
    description: 'Initial balance in BDT',
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: 'initialBalance must be a valid number' })
  @IsPositive()
  @Min(1)
  initialBalance?: number;

  @ApiPropertyOptional({
    example: 1500,
    description: 'Current remaining balance in BDT',
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: 'currentBalance must be a valid number' })
  @Min(0)
  currentBalance?: number;

  @ApiPropertyOptional({
    example: 'recipient@example.com',
    description: 'Email address of the recipient',
  })
  @IsOptional()
  @IsEmail({}, { message: 'A valid recipient email is required' })
  recipientEmail?: string;

  @ApiPropertyOptional({
    example: 'Tahmid Khan',
    description: 'Name of the recipient',
  })
  @IsOptional()
  @IsString()
  recipientName?: string;

  @ApiPropertyOptional({
    example: 'Enjoy your shopping!',
    description: 'Personalized greeting message',
  })
  @IsOptional()
  @IsString()
  customMessage?: string;

  @ApiPropertyOptional({
    enum: GiftCardStatus,
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
}
