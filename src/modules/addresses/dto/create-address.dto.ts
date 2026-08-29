import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddressType } from '@prisma/client';

export class CreateAddressDto {
  @ApiProperty({ example: 'Tamim Iqbal' })
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName!: string;

  @ApiProperty({ example: '+8801712345678' })
  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  phone!: string;

  @ApiProperty({ example: 'House 42, Road 11, Block D' })
  @IsString()
  @IsNotEmpty({ message: 'Address line 1 is required' })
  addressLine1!: string;

  @ApiPropertyOptional({ example: 'Apartment 4B' })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiProperty({ example: 'Dhaka' })
  @IsString()
  @IsNotEmpty({ message: 'City is required' })
  city!: string;

  @ApiPropertyOptional({ example: 'Dhaka Division' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ example: '1213' })
  @IsString()
  @IsNotEmpty({ message: 'Postal code is required' })
  postalCode!: string;

  @ApiPropertyOptional({ example: 'Bangladesh', default: 'Bangladesh' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    enum: AddressType,
    default: AddressType.SHIPPING,
    description: 'Address category: SHIPPING or BILLING',
  })
  @IsOptional()
  @IsEnum(AddressType, { message: 'Address type must be SHIPPING or BILLING' })
  type?: AddressType;

  @ApiPropertyOptional({
    example: true,
    default: false,
    description:
      'Set as default address for this address type. Automatically toggles existing defaults to false.',
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
