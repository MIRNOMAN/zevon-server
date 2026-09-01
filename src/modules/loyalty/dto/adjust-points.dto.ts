import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PointTransactionType } from '@prisma/client';

export class AdjustPointsDto {
  @ApiProperty({
    example: 'user-123',
    description: 'User ID to adjust points for',
  })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({
    example: 50,
    description: 'Points delta (positive to credit, negative to debit)',
  })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  amount!: number;

  @ApiPropertyOptional({
    enum: PointTransactionType,
    example: PointTransactionType.MANUAL_ADJUSTMENT,
    default: PointTransactionType.MANUAL_ADJUSTMENT,
  })
  @IsOptional()
  @IsEnum(PointTransactionType)
  type?: PointTransactionType = PointTransactionType.MANUAL_ADJUSTMENT;

  @ApiProperty({
    example: 'Customer support courtesy bonus for delivery delay',
    description: 'Audit explanation for manual point adjustment',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
