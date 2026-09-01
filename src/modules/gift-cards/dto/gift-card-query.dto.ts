import { IsEnum, IsOptional, IsPositive, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { GiftCardStatus } from '@prisma/client';

export class GiftCardQueryDto {
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
    enum: GiftCardStatus,
    description:
      'Filter gift cards by status (ACTIVE, REDEEMED, EXPIRED, DISABLED)',
  })
  @IsOptional()
  @IsEnum(GiftCardStatus)
  status?: GiftCardStatus;

  @ApiPropertyOptional({
    example: 'ZEV-GIFT',
    description: 'Search by voucher code or recipient email',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
