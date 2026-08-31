import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ToggleWishlistDto {
  @ApiProperty({
    example: 'prod_clx123',
    description: 'Product ID to add or remove from customer wishlist',
  })
  @IsString()
  @IsNotEmpty({ message: 'productId is required' })
  productId!: string;
}
