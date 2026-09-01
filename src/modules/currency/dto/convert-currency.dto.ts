import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConvertCurrencyDto {
  @ApiProperty({ example: 1200, description: 'Monetary amount to convert' })
  @Type(() => Number)
  @IsNumber({}, { message: 'amount must be a valid number' })
  @Min(0, { message: 'amount cannot be negative' })
  @IsNotEmpty()
  amount!: number;

  @ApiPropertyOptional({
    example: 'BDT',
    default: 'BDT',
    description: 'Source currency code (BDT, USD, EUR, GBP)',
  })
  @IsOptional()
  @IsString()
  from?: string = 'BDT';

  @ApiPropertyOptional({
    example: 'USD',
    default: 'USD',
    description: 'Target currency code (USD, EUR, GBP, BDT)',
  })
  @IsOptional()
  @IsString()
  to?: string = 'USD';
}
