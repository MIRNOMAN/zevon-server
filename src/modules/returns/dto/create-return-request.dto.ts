import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReturnResolution } from '@prisma/client';
import { AddressSnapshotDto } from '../../orders/dto/address-snapshot.dto.js';

export class CreateReturnRequestDto {
  @ApiProperty({
    example: 'cm1abcdef0000ghijk1234567',
    description: 'The ID of the delivered order to initiate return for',
  })
  @IsString()
  @IsNotEmpty({ message: 'orderId is required' })
  orderId!: string;

  @ApiProperty({
    example: 'cm1item123456789',
    description: 'The ID of the specific order item being returned',
  })
  @IsString()
  @IsNotEmpty({ message: 'orderItemId is required' })
  orderItemId!: string;

  @ApiProperty({
    example: 'Size is too tight across shoulders. Requesting size exchange.',
    description: 'Detailed reason for return or defect description',
  })
  @IsString()
  @IsNotEmpty({ message: 'Return reason is required' })
  reason!: string;

  @ApiPropertyOptional({
    enum: ReturnResolution,
    example: ReturnResolution.REFUND,
    default: ReturnResolution.REFUND,
    description: 'Resolution choice: REFUND (money back) or EXCHANGE (replacement item)',
  })
  @IsOptional()
  @IsEnum(ReturnResolution, {
    message: 'resolution must be either REFUND or EXCHANGE',
  })
  resolution?: ReturnResolution = ReturnResolution.REFUND;

  @ApiPropertyOptional({
    example: 'cm1variant_xl_black_123',
    description:
      'Product variant ID requested in exchange (required if resolution is EXCHANGE)',
  })
  @IsOptional()
  @IsString()
  exchangeVariantId?: string;

  @ApiPropertyOptional({
    type: [String],
    example: [
      'https://cdn.zevon.com/returns/defect1.jpg',
      'https://cdn.zevon.com/returns/defect2.jpg',
    ],
    description: 'URLs of uploaded photos showing defect or wrong item',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  proofImages?: string[];

  @ApiPropertyOptional({
    type: AddressSnapshotDto,
    description: 'Optional pickup address for courier collection',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressSnapshotDto)
  pickupAddress?: AddressSnapshotDto;
}
