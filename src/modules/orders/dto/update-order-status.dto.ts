import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, PaymentStatus } from '@prisma/client';

export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: OrderStatus,
    example: OrderStatus.PROCESSING,
    description:
      'New order lifecycle status (PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED, RETURNED)',
  })
  @IsEnum(OrderStatus, {
    message:
      'status must be PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED, or RETURNED',
  })
  @IsNotEmpty({ message: 'status is required' })
  status!: OrderStatus;

  @ApiPropertyOptional({
    example: 'Order verified by logistics team and sent for packing.',
    description: 'Internal admin notes or reason for status update',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePaymentStatusDto {
  @ApiProperty({
    enum: PaymentStatus,
    example: PaymentStatus.PAID,
    description:
      'Payment transaction status (PENDING, PAID, FAILED, REFUNDED)',
  })
  @IsEnum(PaymentStatus, {
    message: 'paymentStatus must be PENDING, PAID, FAILED, or REFUNDED',
  })
  @IsNotEmpty({ message: 'paymentStatus is required' })
  paymentStatus!: PaymentStatus;
}
