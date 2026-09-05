import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateContactDto {
  @ApiProperty({
    example: 'Mir Noman',
    description: 'Sender full name',
  })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  name!: string;

  @ApiProperty({
    example: 'customer@example.com',
    description: 'Sender email address',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiPropertyOptional({
    example: '+8801700000000',
    description: 'Sender phone number',
  })
  @IsOptional()
  @IsString()
  @MaxLength(25, { message: 'Phone number cannot exceed 25 characters' })
  phone?: string;

  @ApiPropertyOptional({
    example: 'Order Inquiry / Custom Sizing',
    description: 'Message subject',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Subject cannot exceed 200 characters' })
  subject?: string;

  @ApiProperty({
    example: 'Hello, I would like to inquire about the SS26 heavyweight hoodie restock.',
    description: 'Message body content',
  })
  @IsString()
  @IsNotEmpty({ message: 'Message content is required' })
  @MaxLength(5000, { message: 'Message cannot exceed 5000 characters' })
  message!: string;
}
