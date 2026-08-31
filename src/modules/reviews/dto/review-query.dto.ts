import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  Max,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum ReviewSortOption {
  NEWEST = 'newest',
  HIGHEST = 'highest',
  LOWEST = 'lowest',
}

export class ReviewQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  limit?: number = 10;

  @ApiPropertyOptional({
    example: 5,
    description: 'Filter reviews by specific star rating (1 to 5)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Filter only reviews that include customer photo uploads',
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  hasImages?: boolean;

  @ApiPropertyOptional({
    enum: ReviewSortOption,
    default: ReviewSortOption.NEWEST,
  })
  @IsOptional()
  @IsEnum(ReviewSortOption)
  sortBy?: ReviewSortOption = ReviewSortOption.NEWEST;
}
