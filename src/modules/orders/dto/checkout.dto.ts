import { IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { DeliveryType } from '../../shipping/dto/calculate-shipping.dto.js';
import { AddressSnapshotDto } from './address-snapshot.dto.js';

export class CheckoutDto {
  @ApiPropertyOptional({
    example: 'cuid_shipping_address_123',
    description:
      'ID of a saved customer shipping address in the database. If omitted, shippingAddress object must be provided.',
  })
  @IsOptional()
  @IsString()
  shippingAddressId?: string;

  @ApiPropertyOptional({
    type: AddressSnapshotDto,
    description:
      'Embedded shipping address object (used when customer enters an address directly or for one-off delivery)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressSnapshotDto)
  shippingAddress?: AddressSnapshotDto;

  @ApiPropertyOptional({
    example: 'cuid_billing_address_123',
    description:
      'ID of a saved customer billing address in the database (optional, falls back to shipping address if omitted)',
  })
  @IsOptional()
  @IsString()
  billingAddressId?: string;

  @ApiPropertyOptional({
    type: AddressSnapshotDto,
    description:
      'Embedded billing address object (optional, falls back to shipping address if omitted)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressSnapshotDto)
  billingAddress?: AddressSnapshotDto;

  @ApiPropertyOptional({
    example: 'cuid_shipping_zone_123',
    description:
      'Optional manual shipping zone override. If omitted, zone is automatically resolved from destination city & postal code.',
  })
  @IsOptional()
  @IsString()
  shippingZoneId?: string;

  @ApiPropertyOptional({
    enum: DeliveryType,
    example: DeliveryType.STANDARD,
    default: DeliveryType.STANDARD,
    description: 'Delivery speed preference: STANDARD or EXPRESS',
  })
  @IsOptional()
  @IsEnum(DeliveryType, {
    message: 'deliveryType must be STANDARD or EXPRESS',
  })
  deliveryType?: DeliveryType = DeliveryType.STANDARD;

  @ApiPropertyOptional({
    example: 'ZEVON20',
    description: 'Promotional coupon code to apply for discount',
  })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({
    enum: PaymentMethod,
    example: PaymentMethod.COD,
    default: PaymentMethod.COD,
    description:
      'Payment method: COD (Cash on Delivery), BKASH, NAGAD, SSLCOMMERZ, STRIPE',
  })
  @IsOptional()
  @IsEnum(PaymentMethod, {
    message: 'paymentMethod must be COD, BKASH, NAGAD, SSLCOMMERZ, or STRIPE',
  })
  paymentMethod?: PaymentMethod = PaymentMethod.COD;

  @ApiPropertyOptional({
    example: 'Please call before delivery. Leave package with gate security.',
    description: 'Customer order notes and special delivery instructions',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
