import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TrackOrderDto {
  @ApiProperty({
    example: 'ZV-20260901-4892',
    description: 'Unique order number received during checkout',
  })
  @IsString()
  @IsNotEmpty({ message: 'orderNumber is required' })
  orderNumber!: string;

  @ApiProperty({
    example: 'noman@example.com',
    description: 'Phone number or email address associated with the order',
  })
  @IsString()
  @IsNotEmpty({ message: 'emailOrPhone is required' })
  emailOrPhone!: string;
}
