import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum FitPreference {
  SLIM = 'SLIM',
  REGULAR = 'REGULAR',
  RELAXED = 'RELAXED',
  OVERSIZED = 'OVERSIZED',
}

export enum GenderPreference {
  MEN = 'MEN',
  WOMEN = 'WOMEN',
  UNISEX = 'UNISEX',
}

export class SizeRecommendationDto {
  @ApiProperty({
    example: 175,
    description: 'User height in Centimeters (e.g. 175 cm / approx 5ft 9in)',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'heightCm must be a number' })
  @Min(120, { message: 'heightCm must be at least 120 cm' })
  @Max(230, { message: 'heightCm cannot exceed 230 cm' })
  heightCm!: number;

  @ApiProperty({
    example: 72,
    description: 'User body weight in Kilograms (e.g. 72 kg)',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'weightKg must be a number' })
  @Min(35, { message: 'weightKg must be at least 35 kg' })
  @Max(200, { message: 'weightKg cannot exceed 200 kg' })
  weightKg!: number;

  @ApiPropertyOptional({
    example: 40,
    description: 'Chest circumference in Inches (e.g. 40 inches)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'chestInches must be a number' })
  @Min(26, { message: 'chestInches must be at least 26 inches' })
  @Max(60, { message: 'chestInches cannot exceed 60 inches' })
  chestInches?: number;

  @ApiPropertyOptional({
    example: 32,
    description: 'Waist circumference in Inches (e.g. 32 inches)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'waistInches must be a number' })
  @Min(24, { message: 'waistInches must be at least 24 inches' })
  @Max(55, { message: 'waistInches cannot exceed 55 inches' })
  waistInches?: number;

  @ApiPropertyOptional({
    enum: FitPreference,
    default: FitPreference.REGULAR,
    description: 'Desired fit style: SLIM, REGULAR, RELAXED, or OVERSIZED',
  })
  @IsOptional()
  @IsEnum(FitPreference)
  fitPreference?: FitPreference = FitPreference.REGULAR;

  @ApiPropertyOptional({
    enum: GenderPreference,
    default: GenderPreference.MEN,
    description: 'Gender sizing reference: MEN, WOMEN, or UNISEX',
  })
  @IsOptional()
  @IsEnum(GenderPreference)
  gender?: GenderPreference = GenderPreference.MEN;

  @ApiPropertyOptional({
    example: 'prod_clx123',
    description:
      'Optional product ID to check real-time variant stock availability for recommended size',
  })
  @IsOptional()
  @IsString()
  productId?: string;
}
