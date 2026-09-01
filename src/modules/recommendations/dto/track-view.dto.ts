import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TrackViewDto {
  @ApiProperty({
    example: 'cm1prod_oversized_tee_123',
    description: 'Product ID currently being viewed by the customer',
  })
  @IsString()
  @IsNotEmpty({ message: 'productId is required' })
  productId!: string;

  @ApiPropertyOptional({
    example: 'sess_guest_9823487123',
    description: 'Optional anonymous guest browser session token',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;
}
