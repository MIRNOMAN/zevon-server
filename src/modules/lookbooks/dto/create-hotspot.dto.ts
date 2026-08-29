import { IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateHotspotDto {
  @ApiProperty({
    example: 48.5,
    description: 'Horizontal pin position from left in percentage (0 - 100)',
  })
  @IsNumber({}, { message: 'xPercent must be a number between 0 and 100' })
  @Min(0, { message: 'xPercent cannot be less than 0' })
  @Max(100, { message: 'xPercent cannot exceed 100' })
  xPercent!: number;

  @ApiProperty({
    example: 62.0,
    description: 'Vertical pin position from top in percentage (0 - 100)',
  })
  @IsNumber({}, { message: 'yPercent must be a number between 0 and 100' })
  @Min(0, { message: 'yPercent cannot be less than 0' })
  @Max(100, { message: 'yPercent cannot exceed 100' })
  yPercent!: number;

  @ApiProperty({
    example: 'prod_clx123abc',
    description: 'ID of the product linked to this hotspot pin',
  })
  @IsString()
  @IsNotEmpty({ message: 'productId is required' })
  productId!: string;
}
