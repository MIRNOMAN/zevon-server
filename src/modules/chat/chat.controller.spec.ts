/* eslint-disable @typescript-eslint/unbound-method */
import { Readable } from 'stream';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import type { User } from '@prisma/client';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { AttachmentType } from './dto/chat.dto.js';

describe('ChatController', () => {
  let controller: ChatController;
  let service: ChatService;

  const mockCustomer = {
    id: 'cust-1',
    name: 'Customer One',
    email: 'cust1@example.com',
    role: Role.CUSTOMER,
  } as unknown as User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ChatService,
          useValue: {
            getRoomHistory: jest.fn().mockResolvedValue({
              messages: [],
              meta: {
                total: 0,
                page: 1,
                limit: 30,
                totalPages: 1,
                roomId: 'room_cust-1',
                customerId: 'cust-1',
              },
            }),
            getAdminActiveRooms: jest.fn().mockResolvedValue({
              rooms: [],
              meta: { total: 0, page: 1, limit: 20, totalPages: 1 },
            }),
            markRoomMessagesAsRead: jest.fn().mockResolvedValue({ count: 2 }),
          },
        },
      ],
    }).compile();

    controller = module.get<ChatController>(ChatController);
    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadAttachment', () => {
    it('should format upload response correctly for image', () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'screenshot.png',
        encoding: '7bit',
        mimetype: 'image/png',
        size: 1024,
        destination: '/uploads/chat',
        filename: 'attachment-12345.png',
        path: '/uploads/chat/attachment-12345.png',
        buffer: Buffer.from('test'),
        stream: Readable.from([]),
      };

      const result = controller.uploadAttachment(mockFile);

      expect(result).toEqual({
        url: '/uploads/chat/attachment-12345.png',
        originalName: 'screenshot.png',
        mimetype: 'image/png',
        size: 1024,
        attachmentType: AttachmentType.IMAGE,
      });
    });

    it('should format upload response correctly for PDF', () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'invoice.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 2048,
        destination: '/uploads/chat',
        filename: 'attachment-99999.pdf',
        path: '/uploads/chat/attachment-99999.pdf',
        buffer: Buffer.from('test'),
        stream: Readable.from([]),
      };

      const result = controller.uploadAttachment(mockFile);

      expect(result).toEqual({
        url: '/uploads/chat/attachment-99999.pdf',
        originalName: 'invoice.pdf',
        mimetype: 'application/pdf',
        size: 2048,
        attachmentType: AttachmentType.PDF,
      });
    });
  });

  describe('getChatHistory', () => {
    it('should call chatService.getRoomHistory', async () => {
      await controller.getChatHistory('cust-1', mockCustomer, {
        page: 1,
        limit: 30,
      });
      expect(service.getRoomHistory).toHaveBeenCalledWith(
        'cust-1',
        mockCustomer,
        {
          page: 1,
          limit: 30,
        },
      );
    });
  });

  describe('getActiveRooms', () => {
    it('should call chatService.getAdminActiveRooms', async () => {
      await controller.getActiveRooms({ page: 1, limit: 20 });
      expect(service.getAdminActiveRooms).toHaveBeenCalledWith(1, 20);
    });
  });

  describe('markAsRead', () => {
    it('should call chatService.markRoomMessagesAsRead', async () => {
      await controller.markAsRead('cust-1', mockCustomer);
      expect(service.markRoomMessagesAsRead).toHaveBeenCalledWith(
        'cust-1',
        'cust-1',
      );
    });
  });
});
