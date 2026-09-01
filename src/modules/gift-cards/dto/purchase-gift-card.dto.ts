import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PurchaseGiftCardDto {
  @ApiProperty({
    example: 2000,
    description: 'Gift card balance in BDT (minimum ৳500)',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'amount must be a valid number' })
  @IsPositive({ message: 'amount must be greater than 0' })
  @Min(500, { message: 'Minimum gift card balance is ৳500' })
  @IsNotEmpty()
  amount!: number;

  @ApiProperty({
    example: 'friend@example.com',
    description: 'Email address of the gift recipient',
  })
  @IsEmail({}, { message: 'A valid recipient email is required' })
  @IsNotEmpty()
  recipientEmail!: string;

  @ApiPropertyOptional({
    example: 'Tahmid Khan',
    description: 'Name of the gift recipient',
  })
  @IsOptional()
  @IsString()
  recipientName?: string;

  @ApiPropertyOptional({
    example: 'Happy Birthday Tahmid! Enjoy your new look at ZEVON.',
    description:
      'Personalized greeting message included in the gift card email',
  })
  @IsOptional()
  @IsString()
  customMessage?: string;
}
