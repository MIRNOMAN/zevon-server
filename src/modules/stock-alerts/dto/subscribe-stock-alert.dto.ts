import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubscribeStockAlertDto {
  @ApiProperty({
    example: 'cm1variant_m_black_123',
    description: 'The ID of the out-of-stock product variant (specific size/color)',
  })
  @IsString()
  @IsNotEmpty({ message: 'productVariantId is required' })
  productVariantId!: string;

  @ApiProperty({
    example: 'customer@example.com',
    description: 'Email address to notify when item is restocked',
  })
  @IsEmail({}, { message: 'A valid email address is required' })
  @IsNotEmpty({ message: 'email is required' })
  email!: string;

  @ApiPropertyOptional({
    example: '+8801700000000',
    description: 'Optional phone number for SMS stock alerts',
  })
  @IsOptional()
  @IsString()
  phone?: string;
}
