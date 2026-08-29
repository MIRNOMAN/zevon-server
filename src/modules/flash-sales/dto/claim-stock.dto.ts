import { IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ClaimStockDto {
  @ApiProperty({ example: 'prod_clx123abc' })
  @IsString()
  @IsNotEmpty({ message: 'productId is required' })
  productId!: string;

  @ApiProperty({ example: 1, default: 1 })
  @IsInt()
  @IsPositive({ message: 'quantity must be greater than 0' })
  quantity!: number;
}
