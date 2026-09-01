import { IsEnum, IsOptional, IsPositive, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, PaymentStatus } from '@prisma/client';

export class OrderQueryDto {
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
    enum: OrderStatus,
    description: 'Filter orders by order status',
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({
    enum: PaymentStatus,
    description: 'Filter orders by payment status',
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({
    example: 'ZV-2026',
    description: 'Search by order number or customer details',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
