import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RedeemGiftCardDto {
  @ApiProperty({
    example: 'ZEV-GIFT-8921-4829',
    description: 'Digital gift card voucher code to redeem',
  })
  @IsString()
  @IsNotEmpty({ message: 'code is required' })
  code!: string;

  @ApiProperty({
    example: 1500,
    description: 'Amount in BDT to deduct from gift card balance',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'amount must be a valid number' })
  @IsPositive({ message: 'amount must be greater than 0' })
  @IsNotEmpty()
  amount!: number;

  @ApiPropertyOptional({
    example: 'order-123',
    description: 'Optional Order ID where gift card is being applied',
  })
  @IsOptional()
  @IsString()
  orderId?: string;
}
