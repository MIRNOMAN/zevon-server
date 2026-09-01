import { IsEnum, IsOptional, IsPositive, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { StockAlertStatus } from '@prisma/client';

export class StockAlertQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  limit?: number = 20;

  @ApiPropertyOptional({
    enum: StockAlertStatus,
    description: 'Filter alerts by status (PENDING, NOTIFIED, CANCELLED)',
  })
  @IsOptional()
  @IsEnum(StockAlertStatus)
  status?: StockAlertStatus;

  @ApiPropertyOptional({
    example: 'cm1variant_123',
    description: 'Filter alerts by specific product variant ID',
  })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiPropertyOptional({
    example: 'customer@example.com',
    description: 'Search by email or SKU',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
