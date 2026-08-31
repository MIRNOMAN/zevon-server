import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiscountType } from '@prisma/client';

export class CreateCouponDto {
  @ApiProperty({
    example: 'ZEVON20',
    description: 'Unique coupon promo code (automatically uppercased)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Coupon code is required' })
  code!: string;

  @ApiPropertyOptional({
    example: '20% discount on orders over ৳1500 during Summer 2026 launch',
    description: 'Marketing description of the coupon offer',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    enum: DiscountType,
    example: DiscountType.PERCENTAGE,
    description: 'PERCENTAGE (e.g. 20%) or FIXED_AMOUNT (e.g. ৳300 off)',
  })
  @IsEnum(DiscountType, {
    message: 'discountType must be PERCENTAGE or FIXED_AMOUNT',
  })
  discountType!: DiscountType;

  @ApiProperty({
    example: 20.0,
    description:
      'Discount value (e.g. 20 for 20% off, or 300 for ৳300 flat discount)',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'discountValue must be a valid number' })
  @IsPositive({ message: 'discountValue must be greater than 0' })
  discountValue!: number;

  @ApiPropertyOptional({
    example: 1500.0,
    description: 'Minimum required cart subtotal in BDT to redeem this coupon',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'minOrderAmount must be a valid number' })
  @Min(0, { message: 'minOrderAmount cannot be negative' })
  minOrderAmount?: number;

  @ApiPropertyOptional({
    example: 500.0,
    description:
      'Maximum discount cap in BDT (for percentage discounts e.g. 20% up to ৳500)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'maxDiscountAmount must be a valid number' })
  @Min(0, { message: 'maxDiscountAmount cannot be negative' })
  maxDiscountAmount?: number;

  @ApiProperty({
    example: '2026-08-31T00:00:00.000Z',
    description: 'Coupon validity start date (ISO string)',
  })
  @IsDateString({}, { message: 'startDate must be a valid ISO date string' })
  @IsNotEmpty({ message: 'startDate is required' })
  startDate!: string;

  @ApiProperty({
    example: '2026-09-30T23:59:59.000Z',
    description: 'Coupon validity expiration date (ISO string)',
  })
  @IsDateString({}, { message: 'endDate must be a valid ISO date string' })
  @IsNotEmpty({ message: 'endDate is required' })
  endDate!: string;

  @ApiPropertyOptional({
    example: 500,
    description:
      'Total overall redemption limit for the entire campaign (leave empty for unlimited)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'usageLimit must be an integer' })
  @IsPositive({ message: 'usageLimit must be positive' })
  usageLimit?: number;

  @ApiPropertyOptional({
    example: 1,
    default: 1,
    description:
      'Maximum times an individual customer user can redeem this coupon',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'perUserLimit must be an integer' })
  @IsPositive({ message: 'perUserLimit must be positive' })
  perUserLimit?: number;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Active status of the coupon',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
