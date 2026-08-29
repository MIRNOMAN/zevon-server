import { IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateStatusDto {
  @ApiProperty({ example: false, description: 'Active status of the user' })
  @IsBoolean()
  @IsNotEmpty()
  isActive!: boolean;
}
