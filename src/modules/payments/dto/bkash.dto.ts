import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBkashPaymentDto {
  @ApiProperty({
    example: 'cm1abcdef0000ghijk1234567',
    description: 'Order ID to pay with bKash PGW',
  })
  @IsString()
  @IsNotEmpty({ message: 'orderId is required' })
  orderId!: string;

  @ApiPropertyOptional({
    example: 'https://web.mirnoman.com/order/success',
    description: 'Optional callback URL after bKash process',
  })
  @IsOptional()
  @IsString()
  callbackUrl?: string;
}

export class ExecuteBkashPaymentDto {
  @ApiProperty({
    example: 'TR0011wP12345678',
    description: 'bKash paymentID returned from create payment step',
  })
  @IsString()
  @IsNotEmpty({ message: 'paymentID is required' })
  paymentID!: string;
}
