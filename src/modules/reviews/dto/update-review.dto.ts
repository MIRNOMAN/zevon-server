import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateReviewDto {
  @ApiPropertyOptional({
    example: 5,
    description: 'Updated rating score between 1 and 5',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Rating must be an integer' })
  @Min(1, { message: 'Rating must be at least 1 star' })
  @Max(5, { message: 'Rating cannot exceed 5 stars' })
  rating?: number;

  @ApiPropertyOptional({
    example: 'Updated feedback: Still loving the fit after 5 washes!',
    description: 'Updated review feedback',
  })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({
    example: ['https://images.unsplash.com/photo-review-updated.jpg'],
    type: [String],
    description: 'Updated customer review image URLs',
  })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true, message: 'Each image must be a valid URL' })
  images?: string[];
}
