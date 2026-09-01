import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum DeliveryType {
  STANDARD = 'STANDARD',
  EXPRESS = 'EXPRESS',
}

export class CalculateShippingDto {
  @ApiPropertyOptional({
    example: 'Dhaka',
    description: 'City, division, or area name for automated zone matching',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    example: '1212',
    description:
      'Postal code / Zip code (e.g. 1205, 1212) for high-precision zone lookup',
  })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({
    example: 'cuid12345678',
    description:
      'Direct Shipping Zone ID (if selected directly from a dropdown)',
  })
  @IsOptional()
  @IsString()
  shippingZoneId?: string;

  @ApiPropertyOptional({
    example: 1850.0,
    description:
      'Cart subtotal in BDT. If omitted and customer is logged in, calculates from active user cart in DB.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'cartSubtotal must be a valid number' })
  @Min(0, { message: 'cartSubtotal cannot be negative' })
  cartSubtotal?: number;

  @ApiPropertyOptional({
    enum: DeliveryType,
    example: DeliveryType.STANDARD,
    default: DeliveryType.STANDARD,
    description:
      'Delivery speed preference: STANDARD or EXPRESS (if available for the matched zone)',
  })
  @IsOptional()
  @IsEnum(DeliveryType, {
    message: 'deliveryType must be STANDARD or EXPRESS',
  })
  deliveryType?: DeliveryType = DeliveryType.STANDARD;
}
