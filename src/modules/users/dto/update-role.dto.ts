import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UpdateRoleDto {
  @ApiProperty({ enum: Role, example: Role.MANAGER })
  @IsEnum(Role, { message: 'Role must be CUSTOMER, ADMIN, or MANAGER' })
  @IsNotEmpty()
  role!: Role;
}
