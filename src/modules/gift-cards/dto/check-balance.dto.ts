import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckBalanceDto {
  @ApiProperty({
    example: 'ZEV-GIFT-8921-4829',
    description: 'Unique digital gift card voucher code',
  })
  @IsString()
  @IsNotEmpty({ message: 'code is required' })
  code!: string;
}
