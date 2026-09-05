import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  ParseBoolPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { ContactService } from './contact.service.js';
import { CreateContactDto, SubscribeNewsletterDto } from './dto/index.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';

@ApiTags('Contact & Newsletter')
@Controller()
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  // ── Public Endpoints ──────────────────────────────────────────

  @Public()
  @Post('contact')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Contact inquiry submitted successfully')
  @ApiOperation({ summary: 'Submit a contact message or customer inquiry (Public)' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Message sent successfully' })
  submitContact(@Body() createContactDto: CreateContactDto) {
    return this.contactService.submitContactMessage(createContactDto);
  }

  @Public()
  @Post('newsletter/subscribe')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Subscribed to newsletter successfully')
  @ApiOperation({ summary: 'Subscribe email to newsletter & private archive (Public)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Subscribed successfully' })
  subscribeNewsletter(@Body() subscribeNewsletterDto: SubscribeNewsletterDto) {
    return this.contactService.subscribeNewsletter(subscribeNewsletterDto);
  }

  // ── Admin Endpoints (RBAC Protected) ──────────────────────────

  @Get('contact/messages')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Contact messages retrieved successfully')
  @ApiOperation({ summary: 'List customer contact messages with pagination (Admin/Manager)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'isRead', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAllMessages(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('isRead') isRead?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const isReadBool = isRead !== undefined ? isRead === 'true' : undefined;
    return this.contactService.findAllMessages(pageNum, limitNum, isReadBool, search);
  }

  @Patch('contact/messages/:id/read')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Message marked as read')
  @ApiOperation({ summary: 'Mark contact message as read (Admin/Manager)' })
  markAsRead(@Param('id') id: string) {
    return this.contactService.markAsRead(id);
  }

  @Delete('contact/messages/:id')
  @Roles('ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Message deleted successfully')
  @ApiOperation({ summary: 'Delete a contact message (Admin only)' })
  deleteMessage(@Param('id') id: string) {
    return this.contactService.deleteMessage(id);
  }

  @Get('newsletter/subscribers')
  @Roles('ADMIN', 'MANAGER')
  @ApiBearerAuth('JWT-auth')
  @ResponseMessage('Newsletter subscribers retrieved successfully')
  @ApiOperation({ summary: 'List newsletter subscribers with pagination (Admin/Manager)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  findAllSubscribers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.contactService.findAllSubscribers(pageNum, limitNum);
  }
}
