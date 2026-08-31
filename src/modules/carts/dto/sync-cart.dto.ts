import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SyncCartItemDto {
  @ApiProperty({ example: 'var_clx123' })
  @IsString()
  @IsNotEmpty()
  productVariantId!: string;

  @ApiProperty({ example: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Min(1)
  quantity!: number;
}

export class SyncCartDto {
  @ApiProperty({
    type: [SyncCartItemDto],
    description:
      'Array of guest cart items to merge into the user database cart',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncCartItemDto)
  items!: SyncCartItemDto[];
}
