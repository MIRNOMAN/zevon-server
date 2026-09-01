import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VoiceSearchDto {
  @ApiProperty({
    example: 'Show me a navy blue linen shirt under 2000 for men in size XL',
    description:
      'Transcribed natural language speech query from microphone or voice assistant',
  })
  @IsString()
  @IsNotEmpty({ message: 'Voice search query text cannot be empty' })
  query!: string;

  @ApiPropertyOptional({
    example: 'MEN',
    description: 'Optional gender context filter: MEN, WOMEN, UNISEX',
  })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({
    example: 12,
    default: 12,
    description: 'Number of top search matches to return',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 12;
}

export class VisualSearchDto {
  @ApiPropertyOptional({
    example: 'https://assets.zevon.com/samples/customer-outfit-photo.jpg',
    description:
      'Public URL of uploaded outfit photo to analyze (if not uploading file binary)',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    example: '#1E293B',
    description: 'Optional dominant hex color override for pinpoint matching',
  })
  @IsOptional()
  @IsString()
  hexColor?: string;

  @ApiPropertyOptional({
    example: 'Topwear',
    description: 'Optional category hint (e.g., Topwear, Bottomwear, Footwear)',
  })
  @IsOptional()
  @IsString()
  categoryHint?: string;

  @ApiPropertyOptional({
    example: 12,
    default: 12,
    description: 'Number of closest visual matches to return',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 12;
}

export class ComplementarySearchDto {
  @ApiPropertyOptional({
    example: 'BOTTOM',
    description:
      'Target slot to complete: BOTTOM, FOOTWEAR, OUTERWEAR, ACCESSORY',
  })
  @IsOptional()
  @IsString()
  targetSlot?: string;

  @ApiPropertyOptional({
    example: 6,
    default: 6,
    description: 'Number of complementary styling items to recommend',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 6;
}
