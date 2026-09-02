import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResendOtpDto {
  @ApiProperty({ example: 'customer@example.com' })
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiPropertyOptional({ example: 'REGISTER' })
  @IsOptional()
  @IsString()
  type?: 'REGISTER' | 'RESET';
}
