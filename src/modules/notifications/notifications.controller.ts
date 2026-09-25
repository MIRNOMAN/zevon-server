import { Controller, Get, Post, Body, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

export class MarkReadDto {
  id?: string;
  all?: boolean;
}

@ApiTags('Admin Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Notifications retrieved successfully')
  @ApiOperation({ summary: 'Get all live admin system notifications (Admin/Manager)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Notifications list returned' })
  findAll() {
    return this.notificationsService.findAll();
  }

  @Get('unread-count')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Unread notifications count retrieved')
  @ApiOperation({ summary: 'Get count of unread notifications' })
  getUnreadCount() {
    return this.notificationsService.getUnreadCount();
  }

  @Post('mark-read')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Notifications marked as read')
  @ApiOperation({ summary: 'Mark notifications as read' })
  markAsRead(@Body() dto: MarkReadDto) {
    return this.notificationsService.markAsRead(dto);
  }
}
