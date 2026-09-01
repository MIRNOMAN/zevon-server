import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddressSnapshotDto {
  @ApiProperty({ example: 'Mir Noman', description: 'Recipient full name' })
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName!: string;

  @ApiProperty({ example: '+8801700000000', description: 'Recipient phone number' })
  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  phone!: string;

  @ApiProperty({
    example: 'House 12, Road 5, Block B',
    description: 'Primary street address line',
  })
  @IsString()
  @IsNotEmpty({ message: 'Address line 1 is required' })
  addressLine1!: string;

  @ApiPropertyOptional({
    example: 'Apt 4B',
    description: 'Apartment, suite, unit, building, floor, etc.',
  })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiProperty({ example: 'Dhaka', description: 'City name' })
  @IsString()
  @IsNotEmpty({ message: 'City is required' })
  city!: string;

  @ApiPropertyOptional({ example: 'Dhaka Division', description: 'State or Division' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ example: '1212', description: 'Postal or zip code' })
  @IsString()
  @IsNotEmpty({ message: 'Postal code is required' })
  postalCode!: string;

  @ApiPropertyOptional({
    example: 'Bangladesh',
    default: 'Bangladesh',
    description: 'Country name',
  })
  @IsOptional()
  @IsString()
  country?: string = 'Bangladesh';
}
