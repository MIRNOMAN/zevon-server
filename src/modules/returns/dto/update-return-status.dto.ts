import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReturnStatus } from '@prisma/client';

export class UpdateReturnStatusDto {
  @ApiProperty({
    enum: ReturnStatus,
    example: ReturnStatus.APPROVED,
    description: 'Updated return status (REQUESTED, APPROVED, REJECTED, RECEIVED, REFUNDED)',
  })
  @IsEnum(ReturnStatus, {
    message:
      'status must be REQUESTED, APPROVED, REJECTED, RECEIVED, or REFUNDED',
  })
  @IsNotEmpty({ message: 'status is required' })
  status!: ReturnStatus;

  @ApiPropertyOptional({
    example: 'Return approved. Courier scheduled for pickup on Sep 3.',
    description: 'Admin notes and feedback to the customer',
  })
  @IsOptional()
  @IsString()
  adminNotes?: string;

  @ApiPropertyOptional({
    example: 1200.0,
    description: 'Actual refund amount approved in BDT (for REFUND resolution)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'refundAmount must be a valid number' })
  @Min(0, { message: 'refundAmount cannot be negative' })
  refundAmount?: number;

  @ApiPropertyOptional({
    example: 'TRACK-RET-123456',
    description: 'Courier return tracking number or waybill number',
  })
  @IsOptional()
  @IsString()
  trackingNumber?: string;
}
