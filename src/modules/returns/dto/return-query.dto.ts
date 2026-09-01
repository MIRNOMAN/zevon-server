import { IsEnum, IsOptional, IsPositive, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReturnResolution, ReturnStatus } from '@prisma/client';

export class ReturnQueryDto {
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
    enum: ReturnStatus,
    description: 'Filter returns by status',
  })
  @IsOptional()
  @IsEnum(ReturnStatus)
  status?: ReturnStatus;

  @ApiPropertyOptional({
    enum: ReturnResolution,
    description: 'Filter returns by resolution type (REFUND / EXCHANGE)',
  })
  @IsOptional()
  @IsEnum(ReturnResolution)
  resolution?: ReturnResolution;

  @ApiPropertyOptional({
    example: 'RET-2026',
    description: 'Search by return reference, order number, or customer name',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
