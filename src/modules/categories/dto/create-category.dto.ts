import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'Men',
    description: 'Category name (e.g. Men, Women, Outerwear, Hoodies)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Category name is required' })
  name!: string;

  @ApiPropertyOptional({
    example: 'men',
    description: 'Custom URL slug (auto-generated from name if omitted)',
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({
    example: 'Premium men clothing, oversized tees, hoodies, and jackets',
    description: 'Category description for SEO and UI',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'https://images.unsplash.com/photo-1516826957135-700dedea698c',
    description: 'Category thumbnail or banner image URL',
  })
  @IsOptional()
  @IsUrl({}, { message: 'imageUrl must be a valid URL' })
  imageUrl?: string;

  @ApiPropertyOptional({
    example: 'cat_root123',
    description:
      'Parent category ID for sub-categories (leave empty for Root categories)',
  })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Visibility in navigation and mega-menu',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 1,
    default: 0,
    description: 'Display order in mega-menu and category lists',
  })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
