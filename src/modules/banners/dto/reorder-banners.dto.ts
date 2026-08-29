import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class BannerOrderItemDto {
  @ApiProperty({ example: 'clx123abc' })
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  sortOrder!: number;
}

export class ReorderBannersDto {
  @ApiProperty({
    type: [BannerOrderItemDto],
    description: 'Array of banner IDs with updated sort positions',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BannerOrderItemDto)
  items!: BannerOrderItemDto[];
}
