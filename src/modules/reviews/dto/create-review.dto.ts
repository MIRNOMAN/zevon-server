import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiProperty({
    example: 'prod_clx123topwear',
    description: 'Product ID being reviewed',
  })
  @IsString()
  @IsNotEmpty({ message: 'productId is required' })
  productId!: string;

  @ApiProperty({
    example: 5,
    description: 'Rating score between 1 (lowest) and 5 (highest)',
  })
  @Type(() => Number)
  @IsInt({ message: 'Rating must be an integer' })
  @Min(1, { message: 'Rating must be at least 1 star' })
  @Max(5, { message: 'Rating cannot exceed 5 stars' })
  rating!: number;

  @ApiPropertyOptional({
    example:
      'Superb fabric quality! Heavyweight French Terry feels very premium and the oversized drape is spot on.',
    description: 'Detailed customer review feedback and styling remarks',
  })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({
    example: [
      'https://images.unsplash.com/photo-review-1.jpg',
      'https://images.unsplash.com/photo-review-2.jpg',
    ],
    type: [String],
    description: 'Array of customer unboxing, fit, or styling photo URLs',
  })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true, message: 'Each image must be a valid URL' })
  images?: string[];
}
