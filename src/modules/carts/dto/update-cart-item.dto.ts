import { IsInt, IsPositive, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCartItemDto {
  @ApiProperty({
    example: 2,
    description: 'Updated quantity for this cart line item',
  })
  @Type(() => Number)
  @IsInt({ message: 'Quantity must be an integer' })
  @IsPositive({ message: 'Quantity must be greater than 0' })
  @Min(1, { message: 'Quantity must be at least 1' })
  quantity!: number;
}
