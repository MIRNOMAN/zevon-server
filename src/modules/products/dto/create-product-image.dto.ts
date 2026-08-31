import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductImageDto {
  @ApiProperty({
    example: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518',
    description: 'High resolution product gallery image URL',
  })
  @IsUrl({}, { message: 'Image URL must be a valid URL' })
  @IsNotEmpty({ message: 'Image URL is required' })
  url!: string;

  @ApiPropertyOptional({
    example: 'Front model view wearing oversized midnight black tee',
    description: 'Alternative text for SEO and accessibility',
  })
  @IsOptional()
  @IsString()
  altText?: string;

  @ApiPropertyOptional({
    example: true,
    default: false,
    description: 'Designates this image as the main primary display thumbnail',
  })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({
    example: 1,
    default: 0,
    description: 'Display order sequence in gallery carousel',
  })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
