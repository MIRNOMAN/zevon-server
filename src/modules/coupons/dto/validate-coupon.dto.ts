import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ValidateCouponDto {
  @ApiProperty({
    example: 'ZEVON20',
    description: 'Coupon promo code (case-insensitive)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Coupon code is required' })
  code!: string;

  @ApiPropertyOptional({
    example: 2500.0,
    description:
      'Optional cart subtotal in BDT. If omitted, user active DB shopping cart subtotal is automatically calculated.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'cartSubtotal must be a valid number' })
  @IsPositive({ message: 'cartSubtotal must be greater than 0' })
  cartSubtotal?: number;
}
