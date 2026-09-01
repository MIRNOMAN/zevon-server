import { IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRatesDto {
  @ApiPropertyOptional({
    example: 0.0084,
    description: '1 BDT in USD (e.g. 0.0084 = ~119 BDT per USD)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  USD?: number;

  @ApiPropertyOptional({
    example: 0.0078,
    description: '1 BDT in EUR (e.g. 0.0078 = ~128 BDT per EUR)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  EUR?: number;

  @ApiPropertyOptional({
    example: 0.0066,
    description: '1 BDT in GBP (e.g. 0.0066 = ~151 BDT per GBP)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  GBP?: number;
}
