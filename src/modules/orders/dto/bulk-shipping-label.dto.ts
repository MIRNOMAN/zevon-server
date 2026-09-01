import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class BulkShippingLabelDto {
  @ApiProperty({
    description:
      'List of Order IDs to generate bulk printable shipping labels for',
    example: ['cuid_order_1', 'cuid_order_2'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1, { message: 'At least one order ID must be provided' })
  @ArrayMaxSize(50, { message: 'Cannot generate more than 50 labels at once' })
  orderIds!: string[];
}
