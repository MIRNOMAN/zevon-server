import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateFlashSaleItemDto } from './create-flash-sale-item.dto.js';

export class CreateFlashSaleDto {
  @ApiProperty({
    example: 'Midnight Flash Frenzy - 50% Off',
    description: 'Flash sale campaign title',
  })
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  title!: string;

  @ApiPropertyOptional({
    example: 'midnight-flash-frenzy',
    description: 'Campaign URL slug (auto-generated if omitted)',
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({
    example:
      'Grab limited-edition oversized hoodies and drop shoulder tees at unbeatable prices.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da',
    description: 'Promotional campaign banner image URL',
  })
  @IsOptional()
  @IsUrl({}, { message: 'bannerUrl must be a valid URL' })
  bannerUrl?: string;

  @ApiPropertyOptional({
    example: 50,
    description: 'Headline discount percentage badge for campaign banner',
  })
  @IsOptional()
  @IsInt()
  discountPercent?: number;

  @ApiProperty({
    example: '2026-08-29T12:00:00.000Z',
    description: 'Campaign start date/time (ISO string)',
  })
  @IsDateString({}, { message: 'startTime must be a valid ISO date string' })
  @IsNotEmpty({ message: 'startTime is required' })
  startTime!: string;

  @ApiProperty({
    example: '2026-08-30T00:00:00.000Z',
    description: 'Campaign end date/time (ISO string)',
  })
  @IsDateString({}, { message: 'endTime must be a valid ISO date string' })
  @IsNotEmpty({ message: 'endTime is required' })
  endTime!: string;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Active status of the campaign',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    type: [CreateFlashSaleItemDto],
    description:
      'Array of products with discounted prices and stock allocations',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFlashSaleItemDto)
  items!: CreateFlashSaleItemDto[];
}
