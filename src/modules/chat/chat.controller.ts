import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpStatus,
  ParseFilePipeBuilder,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { Role } from '@prisma/client';
import type { User } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';
import { ChatService } from './chat.service.js';
import {
  ChatHistoryQueryDto,
  UploadResponseDto,
  AttachmentType,
} from './dto/chat.dto.js';

// Ensure upload directory exists
const CHAT_UPLOAD_DIR = join(process.cwd(), 'uploads', 'chat');
if (!existsSync(CHAT_UPLOAD_DIR)) {
  mkdirSync(CHAT_UPLOAD_DIR, { recursive: true });
}

@ApiTags('Support Chat')
@ApiBearerAuth('JWT-auth')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * 1. REST File Attachment Upload (Image / PDF)
   */
  @Post('upload')
  @ApiOperation({
    summary: 'Upload chat attachment (Image or PDF)',
    description:
      'Uploads an image (JPEG/PNG/WEBP/GIF) or PDF document (max 10MB) for chat message attachment.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'File uploaded successfully',
    type: UploadResponseDto,
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          cb(null, CHAT_UPLOAD_DIR);
        },
        filename: (_req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `attachment-${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  @ResponseMessage('File uploaded successfully')
  uploadAttachment(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType:
            /(image\/jpeg|image\/png|image\/webp|image\/gif|application\/pdf)/,
        })
        .addMaxSizeValidator({
          maxSize: 10 * 1024 * 1024,
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    file: Express.Multer.File,
  ): UploadResponseDto {
    if (!file) {
      throw new BadRequestException('No file provided for upload.');
    }

    let attachmentType = AttachmentType.FILE;
    if (file.mimetype.startsWith('image/')) {
      attachmentType = AttachmentType.IMAGE;
    } else if (file.mimetype === 'application/pdf') {
      attachmentType = AttachmentType.PDF;
    }

    const fileUrl = `/uploads/chat/${file.filename}`;

    return {
      url: fileUrl,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      attachmentType,
    };
  }

  /**
   * 2. Admin Active Conversations List
   */
  @Get('rooms')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({
    summary: 'Get list of active customer chat rooms (Admin/Manager)',
    description:
      'Fetches active conversation threads, latest messages, and unread counts for customer support.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Active chat rooms retrieved',
  })
  @ResponseMessage('Chat rooms retrieved successfully')
  async getActiveRooms(@Query() query: ChatHistoryQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    return this.chatService.getAdminActiveRooms(page, limit);
  }

  /**
   * 3. Fetch Offline/Reload Message History
   */
  @Get('history/:customerId')
  @ApiOperation({
    summary: 'Get message history for a customer room',
    description:
      'Customers can retrieve their own history; Admins/Managers can retrieve any customer room history.',
  })
  @ApiParam({
    name: 'customerId',
    description: 'The customer user ID (or room_${customerId})',
    example: 'clx123abc',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Chat history retrieved' })
  @ResponseMessage('Chat history retrieved successfully')
  async getChatHistory(
    @Param('customerId') customerId: string,
    @CurrentUser() user: User,
    @Query() query: ChatHistoryQueryDto,
  ) {
    return this.chatService.getRoomHistory(customerId, user, query);
  }

  /**
   * 4. Mark Room Messages as Read
   */
  @Patch('read/:customerId')
  @ApiOperation({
    summary: 'Mark all unread messages in a room as read',
  })
  @ApiParam({
    name: 'customerId',
    description: 'Customer ID of the room',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Messages marked as read',
  })
  @ResponseMessage('Messages marked as read')
  async markAsRead(
    @Param('customerId') customerId: string,
    @CurrentUser() user: User,
  ) {
    return this.chatService.markRoomMessagesAsRead(customerId, user.id);
  }
}
