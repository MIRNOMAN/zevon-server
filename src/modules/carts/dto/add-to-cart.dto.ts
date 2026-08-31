import { IsInt, IsNotEmpty, IsPositive, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class AddToCartDto {
  @ApiProperty({
    example: 'var_clx123',
    description: 'Product variant ID (specific SKU with chosen color & size)',
  })
  @IsString()
  @IsNotEmpty({ message: 'productVariantId is required' })
  productVariantId!: string;

  @ApiProperty({
    example: 1,
    default: 1,
    description: 'Quantity to add to cart',
  })
  @Type(() => Number)
  @IsInt({ message: 'Quantity must be an integer' })
  @IsPositive({ message: 'Quantity must be greater than 0' })
  @Min(1, { message: 'Quantity must be at least 1' })
  quantity!: number;
}
