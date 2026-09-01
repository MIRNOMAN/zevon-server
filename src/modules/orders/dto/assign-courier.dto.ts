import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignCourierDto {
  @ApiProperty({
    example: 'Pathao Courier',
    description:
      'Name of courier partner (e.g. Pathao Courier, Steadfast, RedX, Paperfly, Sundarban)',
  })
  @IsString()
  @IsNotEmpty({ message: 'courierName is required' })
  courierName!: string;

  @ApiProperty({
    example: 'PTH-DH-2026-98124',
    description:
      'Consignment / Waybill / Tracking number issued by courier partner',
  })
  @IsString()
  @IsNotEmpty({ message: 'trackingNumber is required' })
  trackingNumber!: string;

  @ApiPropertyOptional({
    example: 'Consignment booked. Handed over to delivery agent.',
    description: 'Optional admin dispatch notes or instructions',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
