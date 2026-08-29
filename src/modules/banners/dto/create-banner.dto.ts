import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BannerPlacement } from '@prisma/client';

export class CreateBannerDto {
  @ApiProperty({
    example: 'Urban Summer 2026 Collection',
    description: 'Headline title displayed on the hero slider or banner',
  })
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  title!: string;

  @ApiPropertyOptional({
    example: 'Elevate your wardrobe with breathable luxury fabrics',
    description: 'Secondary subtitle or promotional text',
  })
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiPropertyOptional({
    example: 'Limited Drop',
    description: 'Promotional badge label (e.g. 50% Off, New Arrival)',
  })
  @IsOptional()
  @IsString()
  badge?: string;

  @ApiProperty({
    example: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d',
    description: 'Desktop banner image URL (high resolution)',
  })
  @IsUrl({}, { message: 'imageUrl must be a valid URL' })
  @IsNotEmpty({ message: 'Desktop image URL is required' })
  imageUrl!: string;

  @ApiPropertyOptional({
    example: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f',
    description: 'Mobile-optimized banner image URL',
  })
  @IsOptional()
  @IsUrl({}, { message: 'mobileImageUrl must be a valid URL' })
  mobileImageUrl?: string;

  @ApiPropertyOptional({
    example: 'Shop Now',
    description: 'Call-to-Action button text',
  })
  @IsOptional()
  @IsString()
  ctaText?: string;

  @ApiPropertyOptional({
    example: '/collections/summer-2026',
    description: 'Call-to-Action target link URL',
  })
  @IsOptional()
  @IsString()
  linkUrl?: string;

  @ApiPropertyOptional({
    enum: BannerPlacement,
    default: BannerPlacement.HERO,
    description: 'Banner placement location',
  })
  @IsOptional()
  @IsEnum(BannerPlacement, {
    message: 'Placement must be HERO, SECTION_TOP, SECTION_MIDDLE, or POPUP',
  })
  placement?: BannerPlacement;

  @ApiPropertyOptional({
    example: 1,
    default: 0,
    description: 'Display position order (lowest numbers display first)',
  })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Visibility status of the banner',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: '2026-06-01T00:00:00.000Z',
    description: 'Schedule start date/time (optional)',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-08-31T23:59:59.000Z',
    description: 'Schedule end date/time (optional)',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
