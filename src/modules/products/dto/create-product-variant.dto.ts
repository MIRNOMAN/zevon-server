import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductVariantDto {
  @ApiProperty({
    example: 'TSH-OVR-BLK-M',
    description: 'Unique Stock Keeping Unit (SKU) identifier',
  })
  @IsString()
  @IsNotEmpty({ message: 'SKU is required' })
  sku!: string;

  @ApiProperty({
    example: 'Midnight Black',
    description: 'Color name (e.g. Vintage Olive, Heather Grey)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Color name is required' })
  color!: string;

  @ApiProperty({
    example: '#111111',
    description: 'Hex color code for swatch preview on UI',
  })
  @IsString()
  @IsNotEmpty({ message: 'Color code is required' })
  colorCode!: string;

  @ApiProperty({
    example: 'M',
    description: 'Clothing size (e.g. XS, S, M, L, XL, XXL, 28, 30, 32)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Size is required' })
  size!: string;

  @ApiProperty({
    example: 45,
    default: 0,
    description: 'Initial physical inventory stock quantity for this variant',
  })
  @IsInt({ message: 'Stock must be an integer' })
  @Min(0, { message: 'Stock cannot be negative' })
  stock!: number;

  @ApiPropertyOptional({
    example: 0.0,
    default: 0.0,
    description: 'Extra incremental price for this variant if applicable',
  })
  @IsOptional()
  @IsNumber({}, { message: 'extraPrice must be a valid number' })
  @Min(0, { message: 'extraPrice cannot be negative' })
  extraPrice?: number;

  @ApiPropertyOptional({
    example: 'https://images.unsplash.com/photo-black-tee.jpg',
    description: 'Specific color swatch or variant image URL',
  })
  @IsOptional()
  @IsUrl({}, { message: 'imageUrl must be a valid URL' })
  imageUrl?: string;
}
