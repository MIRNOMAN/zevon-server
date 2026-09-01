import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RedeemPointsDto {
  @ApiProperty({
    example: 100,
    description:
      'Number of loyalty points to redeem (1 point = ৳1 BDT discount)',
  })
  @Type(() => Number)
  @IsInt({ message: 'points must be an integer' })
  @IsPositive({ message: 'points must be greater than 0' })
  @Min(10, { message: 'Minimum redemption is 10 points' })
  @IsNotEmpty()
  points!: number;

  @ApiPropertyOptional({
    example: 'order-123',
    description: 'Optional order ID applying the redemption',
  })
  @IsOptional()
  @IsString()
  orderId?: string;
}
