import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class RegisterAdminDto {
  @ApiProperty({ example: 'admin@zevon.com' })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({ example: 'Admin User' })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;

  @ApiProperty({ example: 'AdminP@ssw0rd123!' })
  @IsString()
  @MinLength(8, { message: 'Admin password must be at least 8 characters' })
  password!: string;

  @ApiPropertyOptional({ example: '+8801812345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ enum: [Role.ADMIN, Role.MANAGER], default: Role.ADMIN })
  @IsEnum(Role, { message: 'Role must be ADMIN or MANAGER' })
  @IsNotEmpty()
  role!: Role;

  @ApiProperty({
    example: 'zevon-admin-secret-2026',
    description: 'Secret master key to authorize admin account creation',
  })
  @IsString()
  @IsNotEmpty({ message: 'Admin secret key is required' })
  adminSecretKey!: string;
}
