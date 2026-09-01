import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateShippingZoneDto {
  @ApiProperty({
    example: 'Inside Dhaka City',
    description: 'Human-readable name of the shipping zone',
  })
  @IsString()
  @IsNotEmpty({ message: 'Shipping zone name is required' })
  name!: string;

  @ApiPropertyOptional({
    example: 'INSIDE_DHAKA',
    description: 'Unique identifier code (e.g. INSIDE_DHAKA, OUTSIDE_DHAKA)',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    example:
      'Covers all Metropolitan Dhaka areas with express and standard options.',
    description: 'Internal or customer-facing description of the zone',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: ['Dhaka', 'Gulshan', 'Banani', 'Dhanmondi', 'Uttara', 'Mirpur'],
    description: 'List of city or area names covered by this zone',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cities?: string[];

  @ApiPropertyOptional({
    example: ['1200', '1205', '1212', '1216', '1230'],
    description: 'List of postal/zip codes or prefixes covered by this zone',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  postalCodes?: string[];

  @ApiProperty({
    example: 60.0,
    description: 'Standard shipping cost in BDT',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'cost must be a valid number' })
  @Min(0, { message: 'cost cannot be negative' })
  cost!: number;

  @ApiPropertyOptional({
    example: 130.0,
    description: 'Optional express or fast delivery rate in BDT',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'expressCost must be a valid number' })
  @Min(0, { message: 'expressCost cannot be negative' })
  expressCost?: number;

  @ApiPropertyOptional({
    example: 2000.0,
    description:
      'Cart subtotal in BDT at which standard shipping becomes free for this zone',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'freeShippingThreshold must be a valid number' })
  @Min(0, { message: 'freeShippingThreshold cannot be negative' })
  freeShippingThreshold?: number;

  @ApiPropertyOptional({
    example: 0.0,
    description: 'Minimum required order spend in BDT to order to this zone',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'minOrderAmount must be a valid number' })
  @Min(0, { message: 'minOrderAmount cannot be negative' })
  minOrderAmount?: number;

  @ApiProperty({
    example: '1-2 Business Days',
    description: 'Estimated standard delivery duration',
  })
  @IsString()
  @IsNotEmpty({ message: 'estimatedDeliveryDays is required' })
  estimatedDeliveryDays!: string;

  @ApiPropertyOptional({
    example: 'Same-Day Delivery (4-6 Hours)',
    description: 'Estimated express delivery duration',
  })
  @IsOptional()
  @IsString()
  expressDeliveryDays?: string;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description:
      'Whether this zone serves as default fallback when postal code/city does not match any zone',
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description:
      'Whether this shipping zone is actively available for checkout',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 1,
    default: 0,
    description: 'Display order priority in UI',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'sortOrder must be an integer' })
  sortOrder?: number;
}
