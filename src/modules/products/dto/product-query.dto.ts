import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum ProductSortOption {
  NEWEST = 'newest',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  RATING = 'rating',
  POPULAR = 'popular',
}

export class ProductQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    default: 20,
    description: 'Items per page',
  })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  limit?: number = 20;

  @ApiPropertyOptional({
    example: 'french terry',
    description:
      'Full-text search across title, description, details, fabric specs, tags, and SKU',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 'oversized-t-shirts',
    description:
      'Category SEO slug (also automatically matches products in its sub-categories)',
  })
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @ApiPropertyOptional({
    example: 'cat_clx123topwear',
    description: 'Direct Category ID filter',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    example: 'Men',
    description: 'Filter by gender / target audience: Men, Women, Unisex, Kids',
  })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({
    example: 'Summer 2026',
    description: 'Filter by season collection drop',
  })
  @IsOptional()
  @IsString()
  season?: string;

  @ApiPropertyOptional({
    example: 'S,M,L',
    description:
      'Filter by multiple clothing sizes (comma-separated or string)',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
    }
    return value;
  })
  sizes?: string[];

  @ApiPropertyOptional({
    example: 'M',
    description: 'Filter by single clothing size',
  })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiPropertyOptional({
    example: 'Midnight Black,Vintage Olive',
    description:
      'Filter by multiple clothing colors (comma-separated or string)',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
    }
    return value;
  })
  colors?: string[];

  @ApiPropertyOptional({
    example: 'Midnight Black',
    description: 'Filter by single clothing color',
  })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({
    example: 500,
    description: 'Minimum price threshold in BDT',
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({
    example: 3000,
    description: 'Maximum price threshold in BDT',
  })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  maxPrice?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Filter only products that are currently in stock (stock > 0)',
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Filter featured products showcase',
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Filter by publish status (Public catalog defaults to true)',
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({
    enum: ProductSortOption,
    default: ProductSortOption.NEWEST,
    description:
      'Multi-sorting option: newest (latest), price_asc (low to high), price_desc (high to low), rating (top rated), popular (featured)',
  })
  @IsOptional()
  @IsEnum(ProductSortOption)
  sortBy?: ProductSortOption = ProductSortOption.NEWEST;
}
