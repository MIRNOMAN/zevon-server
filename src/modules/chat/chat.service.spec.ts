import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ChatService } from './chat.service.js';
import { PrismaService } from '../../database/prisma.service.js';

describe('ChatService', () => {
  let service: ChatService;
  let prisma: {
    chatMessage: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      groupBy: jest.Mock;
      findFirst: jest.Mock;
      updateMany: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
    };
  };

  const mockCustomer = {
    id: 'cust-1',
    name: 'Customer One',
    email: 'cust1@example.com',
    role: Role.CUSTOMER,
    avatarUrl: null,
  };

  const mockAdmin = {
    id: 'admin-1',
    name: 'Admin One',
    email: 'admin@example.com',
    role: Role.ADMIN,
    avatarUrl: null,
  };

  const mockMessage = {
    id: 'msg-1',
    roomId: 'room_cust-1',
    senderId: 'cust-1',
    customerId: 'cust-1',
    content: 'Hello Support!',
    attachmentUrl: null,
    attachmentType: null,
    isRead: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    sender: mockCustomer,
  };

  beforeEach(async () => {
    prisma = {
      chatMessage: {
        create: jest.fn().mockResolvedValue(mockMessage),
        findMany: jest.fn().mockResolvedValue([mockMessage]),
        count: jest.fn().mockResolvedValue(1),
        groupBy: jest
          .fn()
          .mockResolvedValue([
            { customerId: 'cust-1', _max: { createdAt: new Date() } },
          ]),
        findFirst: jest.fn().mockResolvedValue(mockMessage),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(mockCustomer),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('saveMessage', () => {
    it('should save text message correctly', async () => {
      const result = await service.saveMessage(
        'cust-1',
        'cust-1',
        'room_cust-1',
        {
          content: 'Hello Support!',
        },
      );

      expect(prisma.chatMessage.create).toHaveBeenCalledWith({
        data: {
          roomId: 'room_cust-1',
          senderId: 'cust-1',
          customerId: 'cust-1',
          content: 'Hello Support!',
          attachmentUrl: null,
          attachmentType: null,
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              avatarUrl: true,
            },
          },
        },
      });
      expect(result).toEqual(mockMessage);
    });

    it('should throw BadRequestException when both content and attachmentUrl are missing', async () => {
      await expect(
        service.saveMessage('cust-1', 'cust-1', 'room_cust-1', {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getRoomHistory', () => {
    it('should allow customer to access their own history', async () => {
      const result = await service.getRoomHistory('cust-1', mockCustomer, {
        page: 1,
        limit: 10,
      });
      expect(result.messages).toEqual([mockMessage]);
      expect(result.meta.roomId).toBe('room_cust-1');
    });

    it('should deny customer access to another customer room history', async () => {
      await expect(
        service.getRoomHistory('cust-2', mockCustomer, { page: 1, limit: 10 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to access any customer room history', async () => {
      const result = await service.getRoomHistory('cust-1', mockAdmin, {
        page: 1,
        limit: 10,
      });
      expect(result.messages).toEqual([mockMessage]);
    });
  });

  describe('getAdminActiveRooms', () => {
    it('should return active rooms with unread count and latest message', async () => {
      const result = await service.getAdminActiveRooms(1, 10);
      expect(result.rooms.length).toBe(1);
      expect(result.rooms[0].customerId).toBe('cust-1');
      expect(result.rooms[0].unreadCount).toBe(1);
    });
  });

  describe('markRoomMessagesAsRead', () => {
    it('should mark unread messages as read', async () => {
      const result = await service.markRoomMessagesAsRead('cust-1', 'admin-1');
      expect(prisma.chatMessage.updateMany).toHaveBeenCalledWith({
        where: {
          customerId: 'cust-1',
          senderId: { not: 'admin-1' },
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });
      expect(result).toEqual({ count: 1 });
    });
  });
});
