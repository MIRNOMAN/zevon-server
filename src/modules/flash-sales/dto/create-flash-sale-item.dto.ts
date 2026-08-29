import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFlashSaleItemDto {
  @ApiProperty({
    example: 'prod_clx123abc',
    description: 'Product ID to include in the flash sale',
  })
  @IsString()
  @IsNotEmpty({ message: 'productId is required' })
  productId!: string;

  @ApiProperty({
    example: 890.0,
    description: 'Exclusive discounted sale price during campaign',
  })
  @IsNumber({}, { message: 'discountPrice must be a valid number' })
  @IsPositive({ message: 'discountPrice must be greater than 0' })
  discountPrice!: number;

  @ApiPropertyOptional({
    example: 40,
    description: 'Discount percentage badge (optional)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  discountPercent?: number;

  @ApiProperty({
    example: 50,
    default: 100,
    description: 'Total stock units allocated exclusively for this flash sale',
  })
  @IsInt()
  @IsPositive({ message: 'quantityLimit must be at least 1' })
  quantityLimit!: number;

  @ApiPropertyOptional({
    example: 0,
    default: 0,
    description: 'Initial sold/claimed stock count',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  soldCount?: number;
}
