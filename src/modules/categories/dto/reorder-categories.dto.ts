import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CategoryOrderItemDto {
  @ApiProperty({ example: 'cat_clx123' })
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  sortOrder!: number;
}

export class ReorderCategoriesDto {
  @ApiProperty({
    type: [CategoryOrderItemDto],
    description: 'Array of category IDs with updated sort positions',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryOrderItemDto)
  items!: CategoryOrderItemDto[];
}
