import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateHotspotDto } from './create-hotspot.dto.js';

export class CreateLookbookDto {
  @ApiProperty({
    example: 'Weekend Streetwear & Oversized Vibe',
    description: 'Lookbook styling title',
  })
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  title!: string;

  @ApiPropertyOptional({
    example: 'weekend-streetwear-vibe',
    description: 'Custom SEO slug (auto-generated if omitted)',
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({
    example:
      'Curated urban everyday outfits styled with oversized tees, cargo trousers, and layered accessories.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 'https://images.unsplash.com/photo-1509631179647-0177331693ae',
    description: 'High-resolution editorial cover image URL',
  })
  @IsUrl({}, { message: 'coverImageUrl must be a valid URL' })
  @IsNotEmpty({ message: 'Cover image URL is required' })
  coverImageUrl!: string;

  @ApiPropertyOptional({
    example: ['Casual', 'Streetwear', 'Winter'],
    type: [String],
    description: 'Categorization tags (e.g. Casual, Formal, Winter, Festive)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Public visibility status',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 1,
    default: 0,
    description: 'Display order priority',
  })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({
    type: [CreateHotspotDto],
    description: 'Interactive shoppable hotspot pins linked to products',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateHotspotDto)
  hotspots?: CreateHotspotDto[];
}
