import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AttachmentType {
  IMAGE = 'IMAGE',
  PDF = 'PDF',
  FILE = 'FILE',
}

export class SendMessagePayloadDto {
  @ApiProperty({
    example: 'room_clx123abc',
    description: 'The target room identifier (format: room_${customerId})',
  })
  @IsString()
  @IsNotEmpty()
  roomId!: string;

  @ApiPropertyOptional({
    example: 'Hello, I have a question about my order #ORD-12345',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;

  @ApiPropertyOptional({
    example: '/uploads/chat/1725260000000-receipt.pdf',
    description: 'URL of uploaded attachment if any',
  })
  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @ApiPropertyOptional({
    enum: AttachmentType,
    example: AttachmentType.IMAGE,
  })
  @IsOptional()
  @IsEnum(AttachmentType)
  attachmentType?: AttachmentType;
}

export class JoinRoomPayloadDto {
  @ApiProperty({
    example: 'clx123abc',
    description: 'The customer user ID whose room the admin wants to join',
  })
  @IsString()
  @IsNotEmpty()
  customerId!: string;
}

export class TypingPayloadDto {
  @ApiProperty({ example: 'room_clx123abc' })
  @IsString()
  @IsNotEmpty()
  roomId!: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  isTyping?: boolean = true;
}

export class ChatHistoryQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  page?: number = 1;

  @ApiPropertyOptional({ example: 30, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  limit?: number = 30;
}

export class UploadResponseDto {
  @ApiProperty({ example: '/uploads/chat/1725260000000-image.png' })
  url!: string;

  @ApiProperty({ example: 'receipt.pdf' })
  originalName!: string;

  @ApiProperty({ example: 'image/png' })
  mimetype!: string;

  @ApiProperty({ example: 1048576 })
  size!: number;

  @ApiProperty({ enum: AttachmentType, example: AttachmentType.IMAGE })
  attachmentType!: AttachmentType;
}
