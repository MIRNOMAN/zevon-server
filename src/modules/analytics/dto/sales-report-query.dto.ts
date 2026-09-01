import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';

export enum GroupByInterval {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export class SalesReportQueryDto {
  @ApiPropertyOptional({
    example: '2026-08-01T00:00:00.000Z',
    description: 'Start date for sales report filtering (ISO string)',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-09-01T23:59:59.000Z',
    description: 'End date for sales report filtering (ISO string)',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    enum: GroupByInterval,
    example: GroupByInterval.DAY,
    default: GroupByInterval.DAY,
    description: 'Time interval aggregation (day, week, month)',
  })
  @IsOptional()
  @IsEnum(GroupByInterval)
  groupBy?: GroupByInterval = GroupByInterval.DAY;

  @ApiPropertyOptional({
    enum: PaymentStatus,
    description: 'Filter by payment transaction status',
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;
}
