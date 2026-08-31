import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateProductVariantDto } from './create-product-variant.dto.js';
import { CreateProductImageDto } from './create-product-image.dto.js';

export class CreateProductDto {
  @ApiProperty({
    example: 'Heavyweight French Terry Oversized Tee',
    description: 'Product marketing title',
  })
  @IsString()
  @IsNotEmpty({ message: 'Product title is required' })
  title!: string;

  @ApiPropertyOptional({
    example: 'heavyweight-french-terry-oversized-tee',
    description: 'Custom SEO slug (auto-generated from title if omitted)',
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiProperty({
    example:
      'Engineered from 240 GSM organic combed cotton with dropped shoulders, boxy silhouette, and signature ribbed collar.',
    description: 'Detailed product overview description',
  })
  @IsString()
  @IsNotEmpty({ message: 'Product description is required' })
  description!: string;

  @ApiPropertyOptional({
    example:
      'Features reinforced twin-needle stitching, pre-shrunk fabric to prevent post-wash shrinkage, and custom branded neck tape.',
    description: 'Additional technical specifications and style notes',
  })
  @IsOptional()
  @IsString()
  details?: string;

  @ApiPropertyOptional({
    example: '100% Combed Compact Cotton, 240 GSM Heavyweight French Terry',
    description: 'Fabric specifications, GSM, and textile composition',
  })
  @IsOptional()
  @IsString()
  fabricSpecs?: string;

  @ApiPropertyOptional({
    example:
      'Machine wash cold inside out with like colors. Do not bleach. Tumble dry low or hang dry in shade. Warm iron on reverse side.',
    description: 'Care instructions and washing guide',
  })
  @IsOptional()
  @IsString()
  washCare?: string;

  @ApiPropertyOptional({
    example: ['Oversized', 'Heavyweight', 'Streetwear', 'Drop Shoulder'],
    type: [String],
    description: 'Product tags and filter keywords',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({
    example: 1450.0,
    description: 'Base regular retail price in BDT',
  })
  @IsNumber({}, { message: 'basePrice must be a valid number' })
  @IsPositive({ message: 'basePrice must be greater than 0' })
  basePrice!: number;

  @ApiPropertyOptional({
    example: 1250.0,
    description: 'Discounted promotional price if on special offer',
  })
  @IsOptional()
  @IsNumber({}, { message: 'discountPrice must be a valid number' })
  @Min(0, { message: 'discountPrice cannot be negative' })
  discountPrice?: number;

  @ApiProperty({
    example: 'cat_clx123topwear',
    description: 'Parent Category ID for classification',
  })
  @IsString()
  @IsNotEmpty({ message: 'categoryId is required' })
  categoryId!: string;

  @ApiPropertyOptional({
    example: true,
    default: false,
    description: 'Highlight product on Home page featured carousel',
  })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Publish status (true = visible in shop, false = draft)',
  })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({
    example: 'Men',
    description: 'Target audience / gender: Men, Women, Unisex, Kids',
  })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({
    example: 'Summer 2026',
    description:
      'Season / Campaign drop: Summer 2026, Winter Drop, Eid Festive',
  })
  @IsOptional()
  @IsString()
  season?: string;

  @ApiProperty({
    type: [CreateProductVariantDto],
    description:
      'Clothing variants with specific SKU, Color, ColorCode, Size, and Stock allocation',
  })
  @IsArray({ message: 'Variants must be an array' })
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants!: CreateProductVariantDto[];

  @ApiPropertyOptional({
    type: [CreateProductImageDto],
    description:
      'Product gallery media images with sort order and primary flag',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductImageDto)
  images?: CreateProductImageDto[];
}
