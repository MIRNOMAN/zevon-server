import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'CurrentP@ss123' })
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  oldPassword!: string;

  @ApiProperty({ example: 'NewSuperStrongP@ss2026' })
  @IsString()
  @MinLength(6, { message: 'New password must be at least 6 characters' })
  newPassword!: string;
}
