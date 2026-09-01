import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { OutfitSlot } from '@prisma/client';

export class CreateOutfitItemDto {
  @ApiProperty({
    example: 'prod_clx123top',
    description: 'Target clothing product ID',
  })
  @IsString()
  @IsNotEmpty({ message: 'productId is required' })
  productId!: string;

  @ApiPropertyOptional({
    example: 'var_clx123size_m',
    description: 'Default pre-selected variant SKU ID',
  })
  @IsOptional()
  @IsString()
  defaultVariantId?: string;

  @ApiProperty({
    enum: OutfitSlot,
    example: OutfitSlot.TOP,
    description: 'Canvas slot: TOP, BOTTOM, FOOTWEAR, OUTERWEAR, ACCESSORY',
  })
  @IsEnum(OutfitSlot, {
    message: 'slot must be TOP, BOTTOM, FOOTWEAR, OUTERWEAR, or ACCESSORY',
  })
  slot!: OutfitSlot;

  @ApiPropertyOptional({
    example: 50.0,
    default: 50.0,
    description: 'X coordinate percentage on canvas (0 - 100%)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  positionX?: number;

  @ApiPropertyOptional({
    example: 30.0,
    default: 50.0,
    description: 'Y coordinate percentage on canvas (0 - 100%)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  positionY?: number;

  @ApiPropertyOptional({
    example: 1,
    default: 1,
    description: 'Canvas layer z-index',
  })
  @IsOptional()
  @IsInt()
  zIndex?: number;

  @ApiPropertyOptional({
    example: 1.0,
    default: 1.0,
    description: 'Visual scale factor on canvas (0.5 - 2.0)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0.2)
  @Max(3.0)
  scale?: number;
}

export class CreateOutfitDto {
  @ApiProperty({
    example: 'Monochrome Street Minimalist Look',
    description: 'Curated outfit marketing title',
  })
  @IsString()
  @IsNotEmpty({ message: 'Outfit title is required' })
  title!: string;

  @ApiPropertyOptional({
    example: 'monochrome-street-minimalist-look',
    description: 'Unique SEO slug (auto-generated if omitted)',
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({
    example:
      'A sleek combination of heavyweight black French terry tee, relaxed charcoal chinos, and premium white leather sneakers.',
    description: 'Stylist inspiration and outfit breakdown',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'https://assets.zevon.com/outfits/street-minimalist.jpg',
    description: 'Rendered lookbook cover or preview banner',
  })
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional({
    example: 'Streetwear',
    description:
      'Occasion / Style: Casual, Streetwear, Formal, Party, Summer, Smart Casual',
  })
  @IsOptional()
  @IsString()
  occasion?: string;

  @ApiPropertyOptional({
    example: 'UNISEX',
    description: 'Target gender: MEN, WOMEN, UNISEX',
  })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({
    example: ['Streetwear', 'Monochrome', 'Summer Fit', 'Drop Shoulder'],
    type: [String],
    description: 'Search and filter tags',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    example: 15,
    default: 10,
    description:
      'Automatic bundle discount percentage applied when purchasing entire look (0-50%)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  bundleDiscountPercent?: number;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Flag if curated by brand stylists or saved by customer',
  })
  @IsOptional()
  @IsBoolean()
  isCurated?: boolean;

  @ApiProperty({
    type: [CreateOutfitItemDto],
    description:
      'Garment slots in the outfit (Top, Bottom, Footwear, Outerwear, Accessories)',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOutfitItemDto)
  items!: CreateOutfitItemDto[];
}

export class UpdateOutfitDto extends PartialType(CreateOutfitDto) {}

export class CalculateOutfitTotalDto {
  @ApiProperty({
    example: ['var_clx123top_m', 'var_clx456bottom_32', 'var_clx789shoe_42'],
    type: [String],
    description:
      'Array of selected product variant IDs (Top, Bottom, Footwear, etc.) on the canvas',
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ message: 'variantIds array cannot be empty' })
  variantIds!: string[];

  @ApiPropertyOptional({
    example: 10,
    default: 10,
    description: 'Optional custom bundle discount percentage override (0-50%)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  bundleDiscountPercent?: number;
}

export class OutfitCheckoutBundleItemDto {
  @ApiProperty({
    example: 'var_clx123top_m',
    description: 'Product variant SKU ID to add to cart',
  })
  @IsString()
  @IsNotEmpty()
  productVariantId!: string;

  @ApiPropertyOptional({
    example: 1,
    default: 1,
    description: 'Quantity',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  quantity: number = 1;
}

export class OutfitCheckoutBundleDto {
  @ApiProperty({
    type: [OutfitCheckoutBundleItemDto],
    description:
      'Array of outfit items to add directly to the shopping cart in 1-click',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OutfitCheckoutBundleItemDto)
  items!: OutfitCheckoutBundleItemDto[];
}

export class OutfitQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 12;

  @ApiPropertyOptional({
    description: 'Filter by occasion (Casual, Streetwear, Formal, etc.)',
  })
  @IsOptional()
  @IsString()
  occasion?: string;

  @ApiPropertyOptional({ description: 'Filter by gender (MEN, WOMEN, UNISEX)' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({
    description: 'Filter curated stylist outfits vs user mixes',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isCurated?: boolean;

  @ApiPropertyOptional({
    description: 'Search keywords in outfit title or description',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
