import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCheckoutSessionDto {
  @ApiProperty({
    example: 'cm1abcdef0000ghijk1234567',
    description: 'The unique ID of the order to create a payment session for',
  })
  @IsString()
  @IsNotEmpty({ message: 'orderId is required' })
  orderId!: string;

  @ApiPropertyOptional({
    example:
      'http://localhost:3000/order/success?session_id={CHECKOUT_SESSION_ID}',
    description: 'Custom success redirect URL after payment completion',
  })
  @IsOptional()
  @IsString()
  successUrl?: string;

  @ApiPropertyOptional({
    example: 'http://localhost:3000/order/cancel',
    description: 'Custom cancel redirect URL if customer aborts checkout',
  })
  @IsOptional()
  @IsString()
  cancelUrl?: string;
}
